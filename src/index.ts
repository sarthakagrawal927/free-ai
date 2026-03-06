import { swaggerUI } from '@hono/swagger-ui';
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import pLimit from 'p-limit';
import pRetry from 'p-retry';
import { AbortError } from 'p-retry';
import { getModelKey, getModelRegistry, getProviderLimits, getRateLimitConfig } from './config';
import { providerCallers, providerEmbeddingCallers } from './providers';
import { classifyError, isRetriableFailure } from './router/classify-error';
import { selectCandidates } from './router/select-model';
import { consumeIpRateLimit, healthLookup, healthRecord, healthSnapshot, nextRoundRobinOffset } from './state/client';
import { HealthStateDO } from './state/health-do';
import { IpRateLimitDO } from './state/ip-rate-limit-do';
import { createSseStream, toSseData } from './utils/sse';
import { buildCompletionEnvelope, createRequestId, getErrorMessage, normalizeMessages } from './utils/request';
import type {
  EmbeddingProvider,
  Env,
  GatewayMeta,
  ModelCandidate,
  NormalizedChatRequest,
  Provider,
  ProviderLimitConfig,
  TextProvider,
} from './types';

const app = new OpenAPIHono<{ Bindings: Env }>();

const messageSchema = z
  .object({
    role: z.enum(['system', 'user', 'assistant', 'tool']),
    content: z.string().min(1).max(100_000),
    name: z.string().optional(),
  })
  .openapi('ChatMessage');

const projectIdSchema = z.string().min(1).max(64).regex(/^[a-zA-Z0-9._:-]+$/);

const chatRequestSchema = z
  .object({
    model: z.string().default('auto'),
    messages: z.array(messageSchema).optional(),
    prompt: z.string().optional(),
    stream: z.boolean().default(false),
    temperature: z.number().min(0).max(2).optional(),
    max_tokens: z.number().int().min(1).max(8192).optional(),
    reasoning_effort: z.enum(['auto', 'low', 'medium', 'high']).default('auto'),
    project_id: projectIdSchema.optional(),
  })
  .openapi('ChatCompletionRequest');

const responsesRequestSchema = z
  .object({
    model: z.string().default('auto'),
    input: z.union([z.string(), z.array(z.unknown()), z.record(z.string(), z.unknown())]),
    stream: z.boolean().default(false),
    temperature: z.number().min(0).max(2).optional(),
    max_output_tokens: z.number().int().min(1).max(8192).optional(),
    reasoning_effort: z.enum(['auto', 'low', 'medium', 'high']).optional(),
    reasoning: z
      .object({
        effort: z.enum(['low', 'medium', 'high']).optional(),
      })
      .optional(),
    project_id: projectIdSchema.optional(),
  })
  .openapi('ResponsesRequest');

const embeddingsRequestSchema = z
  .object({
    model: z.string().min(1),
    input: z.union([z.string(), z.array(z.string().min(1)).min(1)]),
    encoding_format: z.enum(['float']).optional(),
    dimensions: z.number().int().min(1).max(4096).optional(),
    project_id: projectIdSchema.optional(),
  })
  .openapi('EmbeddingsRequest');

const gatewayMetaSchema = z
  .object({
    provider: z.enum(['workers_ai', 'groq', 'gemini', 'voyage_ai', 'openrouter', 'cerebras', 'cli_bridge']),
    model: z.string(),
    attempts: z.number().int().min(1),
    reasoning_effort: z.enum(['auto', 'low', 'medium', 'high']),
    request_id: z.string(),
    project_id: projectIdSchema.optional(),
  })
  .openapi('GatewayMeta');

const nonStreamResponseSchema = z
  .object({
    id: z.string(),
    object: z.string(),
    created: z.number(),
    model: z.string(),
    choices: z.array(
      z.object({
        index: z.number(),
        message: z.object({
          role: z.string(),
          content: z.string().nullable(),
        }),
        finish_reason: z.string().nullable(),
      }),
    ),
    usage: z
      .object({
        prompt_tokens: z.number().optional(),
        completion_tokens: z.number().optional(),
        total_tokens: z.number().optional(),
      })
      .optional(),
    x_gateway: gatewayMetaSchema,
  })
  .openapi('ChatCompletionResponse');

const responsesApiResponseSchema = z
  .object({
    id: z.string(),
    object: z.literal('response'),
    created_at: z.number(),
    status: z.string(),
    model: z.string(),
    output: z.array(
      z.object({
        type: z.literal('message'),
        id: z.string(),
        status: z.string(),
        role: z.literal('assistant'),
        content: z.array(
          z.object({
            type: z.literal('output_text'),
            text: z.string(),
            annotations: z.array(z.unknown()),
          }),
        ),
      }),
    ),
    output_text: z.string(),
    usage: z
      .object({
        input_tokens: z.number().optional(),
        output_tokens: z.number().optional(),
        total_tokens: z.number().optional(),
      })
      .optional(),
    x_gateway: gatewayMetaSchema.optional(),
  })
  .openapi('ResponsesResponse');

const embeddingsResponseSchema = z
  .object({
    object: z.literal('list'),
    data: z.array(
      z.object({
        object: z.literal('embedding'),
        index: z.number(),
        embedding: z.array(z.number()),
      }),
    ),
    model: z.string(),
    usage: z
      .object({
        prompt_tokens: z.number().optional(),
        total_tokens: z.number().optional(),
      })
      .optional(),
    x_gateway: gatewayMetaSchema,
  })
  .openapi('EmbeddingsResponse');

const errorSchema = z
  .object({
    error: z.object({
      message: z.string(),
      type: z.string(),
      code: z.string().optional(),
    }),
  })
  .openapi('ErrorResponse');

const modelItemSchema = z.object({
  id: z.string(),
  provider: z.string(),
  model: z.string(),
  reasoning: z.string(),
  supports_streaming: z.boolean(),
  cooldown_until: z.number(),
  success_rate: z.number(),
  headroom: z.number(),
  enabled: z.boolean(),
});

const healthSchema = z.object({
  ok: z.boolean(),
  models: z.array(
    z.object({
      key: z.string(),
      attempts: z.number(),
      success_rate: z.number(),
      avg_latency_ms: z.number(),
      cooldown_until: z.number(),
      headroom: z.number(),
      daily_used: z.number(),
      daily_limit: z.number(),
    }),
  ),
});

interface EmbeddingCandidate {
  provider: EmbeddingProvider;
  model: string;
  priority: number;
}

const EMBEDDING_CANDIDATES: EmbeddingCandidate[] = [
  {
    provider: 'gemini',
    model: 'gemini-embedding-001',
    priority: 0.95,
  },
  {
    provider: 'voyage_ai',
    model: 'voyage-3.5-lite',
    priority: 0.91,
  },
  {
    provider: 'workers_ai',
    model: '@cf/baai/bge-base-en-v1.5',
    priority: 0.9,
  },
];

const EMBEDDING_MODEL_ALIASES: Record<string, string> = {
  'text-embedding-3-small': 'gemini-embedding-001',
  'text-embedding-3-large': 'gemini-embedding-001',
  'text-embedding-004': 'gemini-embedding-001',
};

app.use('/v1/*', async (c, next) => {
  const config = getRateLimitConfig(c.env);
  const ip = c.req.header('cf-connecting-ip') ?? 'unknown';
  const now = Date.now();

  const rate = await consumeIpRateLimit(c.env, {
    ipKey: ip,
    now,
    capacity: config.capacity,
    refillPerSecond: config.refillPerSecond,
  });

  if (!rate.allowed) {
    c.header('Retry-After', String(rate.retryAfter));
    return c.json(
      {
        error: {
          message: 'Rate limit exceeded',
          type: 'rate_limit_error',
        },
      },
      429,
    );
  }

  c.header('X-RateLimit-Remaining', String(rate.remaining));
  await next();
});

function getForcedTextProvider(c: { req: { header: (key: string) => string | undefined } }): TextProvider | undefined {
  const value = c.req.header('x-gateway-force-provider');
  if (!value) {
    return undefined;
  }

  if (['workers_ai', 'groq', 'gemini', 'openrouter', 'cerebras', 'cli_bridge'].includes(value)) {
    return value as TextProvider;
  }

  return undefined;
}

function getForcedEmbeddingProvider(
  c: { req: { header: (key: string) => string | undefined } },
): EmbeddingProvider | undefined {
  const value = c.req.header('x-gateway-force-provider');
  if (!value) {
    return undefined;
  }

  if (['workers_ai', 'gemini', 'voyage_ai'].includes(value)) {
    return value as EmbeddingProvider;
  }

  return undefined;
}

function workersAiEmbeddingAvailable(env: Env): boolean {
  if (env.AI && typeof env.AI.run === 'function') {
    return true;
  }

  return Boolean(env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_WORKERS_AI_API_KEY);
}

function normalizeEmbeddingInput(input: string | string[]): string[] {
  if (typeof input === 'string') {
    const trimmed = input.trim();
    return trimmed ? [trimmed] : [];
  }

  if (!Array.isArray(input)) {
    return [];
  }

  return input.map((value) => value.trim()).filter((value) => value.length > 0);
}

function resolveEmbeddingCandidates(
  env: Env,
  params: {
    requestedModel: string;
    forcedProvider?: EmbeddingProvider;
    forcedModel?: string;
  },
): EmbeddingCandidate[] {
  const requestedModel = params.requestedModel.trim();
  const alias = EMBEDDING_MODEL_ALIASES[requestedModel];
  const preferredModel = alias ?? requestedModel;

  const filtered = EMBEDDING_CANDIDATES.filter((candidate) => {
    if (params.forcedProvider && candidate.provider !== params.forcedProvider) {
      return false;
    }

    if (params.forcedModel && candidate.model !== params.forcedModel) {
      return false;
    }

    if (candidate.provider === 'gemini' && !env.GEMINI_API_KEY) {
      return false;
    }

    if (candidate.provider === 'workers_ai' && !workersAiEmbeddingAvailable(env)) {
      return false;
    }

    if (candidate.provider === 'voyage_ai' && !env.VOYAGE_API_KEY) {
      return false;
    }

    return true;
  });

  return filtered.sort((a, b) => {
    const aPreferred = preferredModel !== 'auto' && a.model === preferredModel;
    const bPreferred = preferredModel !== 'auto' && b.model === preferredModel;

    if (aPreferred && !bPreferred) {
      return -1;
    }
    if (!aPreferred && bPreferred) {
      return 1;
    }

    return b.priority - a.priority;
  });
}

function rotateByOffset<T>(items: T[], offset: number): T[] {
  if (items.length <= 1) {
    return items;
  }

  const safeOffset = ((Math.floor(offset) % items.length) + items.length) % items.length;
  if (safeOffset === 0) {
    return items;
  }

  return [...items.slice(safeOffset), ...items.slice(0, safeOffset)];
}

function buildChatRoundRobinKey(params: {
  endpoint: 'chat.completions' | 'responses';
  reasoningEffort: NormalizedChatRequest['reasoning_effort'];
  stream: boolean;
  candidates: ModelCandidate[];
}): string {
  const providerSet = params.candidates.map((candidate) => getModelKey(candidate.provider, candidate.model)).join(',');
  return `chat:${params.endpoint}:${params.reasoningEffort}:${params.stream ? 'stream' : 'nonstream'}:${providerSet}`;
}

function isSafetyRefusal(completion: Record<string, unknown> | undefined): boolean {
  const choice = Array.isArray(completion?.choices)
    ? (completion.choices[0] as { finish_reason?: string; message?: { content?: string | null } } | undefined)
    : undefined;

  if (!choice) {
    return false;
  }

  const finishReason = choice.finish_reason?.toLowerCase() ?? '';
  if (finishReason.includes('content_filter') || finishReason.includes('safety')) {
    return true;
  }

  const content = choice.message?.content?.toLowerCase() ?? '';
  if (content.includes('cannot help with') || content.includes('safety policy')) {
    return true;
  }

  return false;
}

function buildGatewayMeta(params: {
  provider: Provider;
  model: string;
  attempts: number;
  reasoning: NormalizedChatRequest['reasoning_effort'];
  requestId: string;
  projectId?: string;
}): GatewayMeta {
  return {
    provider: params.provider,
    model: params.model,
    attempts: params.attempts,
    reasoning_effort: params.reasoning,
    request_id: params.requestId,
    project_id: params.projectId,
  };
}

function resolveProjectId(headerValue: string | undefined, bodyValue: string | undefined): string | undefined {
  const candidate = (headerValue ?? bodyValue)?.trim();
  if (!candidate) {
    return undefined;
  }

  return projectIdSchema.safeParse(candidate).success ? candidate : undefined;
}

function gatherTextFragments(input: unknown, depth = 0): string[] {
  if (depth > 10) {
    return [];
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    return trimmed ? [trimmed] : [];
  }

  if (Array.isArray(input)) {
    return input.flatMap((item) => gatherTextFragments(item, depth + 1));
  }

  if (!input || typeof input !== 'object') {
    return [];
  }

  const record = input as Record<string, unknown>;
  const values: unknown[] = [];

  if (typeof record.text === 'string') values.push(record.text);
  if (typeof record.input_text === 'string') values.push(record.input_text);
  if (typeof record.content === 'string') values.push(record.content);
  if (Array.isArray(record.content)) values.push(...record.content);
  if (Array.isArray(record.input)) values.push(...record.input);

  return values.flatMap((value) => gatherTextFragments(value, depth + 1));
}

function responsesInputToPrompt(input: unknown): string {
  return gatherTextFragments(input).join('\n').trim();
}

function chatCompletionToResponsesObject(completion: Record<string, unknown>): Record<string, unknown> {
  const chatId = typeof completion.id === 'string' ? completion.id : `chatcmpl-${createRequestId()}`;
  const responseId = chatId.startsWith('resp_') ? chatId : `resp_${chatId.replace(/^chatcmpl-?/, '')}`;
  const createdAt =
    typeof completion.created === 'number' ? completion.created : Math.floor(Date.now() / 1000);
  const model = typeof completion.model === 'string' ? completion.model : 'auto';

  const content = String(
    (completion.choices as Array<{ message?: { content?: unknown } }>)?.[0]?.message?.content ?? '',
  );

  const usage = completion.usage as
    | { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
    | undefined;

  return {
    id: responseId,
    object: 'response',
    created_at: createdAt,
    status: 'completed',
    model,
    output: [
      {
        type: 'message',
        id: `msg_${responseId}`,
        status: 'completed',
        role: 'assistant',
        content: [
          {
            type: 'output_text',
            text: content,
            annotations: [],
          },
        ],
      },
    ],
    output_text: content,
    usage: usage
      ? {
          input_tokens: usage.prompt_tokens,
          output_tokens: usage.completion_tokens,
          total_tokens: usage.total_tokens,
        }
      : undefined,
    x_gateway: completion.x_gateway,
  };
}

const chatRoute = createRoute({
  method: 'post',
  path: '/v1/chat/completions',
  request: {
    body: {
      content: {
        'application/json': {
          schema: chatRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Chat completion response',
      content: {
        'application/json': { schema: nonStreamResponseSchema },
        'text/event-stream': {
          schema: z.object({}).openapi({ description: 'SSE stream' }),
        },
      },
    },
    400: {
      description: 'Invalid input',
      content: {
        'application/json': { schema: errorSchema },
      },
    },
    429: {
      description: 'Rate limited',
      content: {
        'application/json': { schema: errorSchema },
      },
    },
    503: {
      description: 'No healthy free-tier model available',
      content: {
        'application/json': { schema: errorSchema },
      },
    },
  },
});

app.openapi(chatRoute, async (c) => {
  const requestStartedAt = Date.now();
  const body = c.req.valid('json');
  const requestId = createRequestId();
  const endpoint = c.req.header('x-gateway-source-endpoint') === 'responses' ? 'responses' : 'chat.completions';
  const normalizedMessages = normalizeMessages(body.messages, body.prompt);
  const messageCount = normalizedMessages.length;
  const promptChars = normalizedMessages.reduce((sum, message) => sum + message.content.length, 0);

  const headerProjectId = c.req.header('x-gateway-project-id') ?? undefined;
  const explicitProjectId = resolveProjectId(headerProjectId, body.project_id);
  if (headerProjectId && !explicitProjectId) {
    return c.json(
      {
        error: {
          message: 'Invalid x-gateway-project-id. Use 1-64 chars [a-zA-Z0-9._:-]',
          type: 'invalid_request_error',
          code: 'invalid_project_id',
        },
      },
      400,
    );
  }

  const projectId = explicitProjectId;

  if (normalizedMessages.length === 0) {
    return c.json(
      {
        error: {
          message: 'Either `messages` or `prompt` is required',
          type: 'invalid_request_error',
          code: 'missing_input',
        },
      },
      400,
    );
  }

  const normalized: NormalizedChatRequest = {
    model: body.model,
    messages: normalizedMessages,
    stream: body.stream,
    temperature: body.temperature,
    max_tokens: body.max_tokens,
    reasoning_effort: body.reasoning_effort,
  };

  const forcedProvider = getForcedTextProvider(c);
  const forcedModel = c.req.header('x-gateway-force-model') ?? undefined;

  let registry = getModelRegistry(c.env);
  if (forcedProvider) {
    registry = registry.filter((model) => model.provider === forcedProvider);
  }

  if (registry.length === 0) {
    return c.json(
      {
        error: {
          message: 'No provider credentials or models configured',
          type: 'configuration_error',
        },
      },
      503,
    );
  }

  const limits = getProviderLimits(c.env);
  const now = Date.now();
  const modelKeys = registry.map((candidate) => getModelKey(candidate.provider, candidate.model));

  const lookupLimits: Record<string, ProviderLimitConfig> = {};
  for (const candidate of registry) {
    const key = getModelKey(candidate.provider, candidate.model);
    lookupLimits[key] = limits[key] ?? { requestsPerDay: 200 };
  }

  const stateMap = await healthLookup(c.env, modelKeys, lookupLimits, now);
  let selected = selectCandidates(registry, stateMap, {
    requestedReasoning: normalized.reasoning_effort,
    stream: normalized.stream,
    now,
    modelOverride: forcedModel,
  });

  const requestedModel = normalized.model.trim().toLowerCase();
  const shouldRoundRobin =
    !forcedProvider && !forcedModel && selected.length > 1 && (requestedModel === '' || requestedModel === 'auto');

  if (shouldRoundRobin) {
    const roundRobinKey = buildChatRoundRobinKey({
      endpoint,
      reasoningEffort: normalized.reasoning_effort,
      stream: normalized.stream,
      candidates: selected,
    });

    const offset = await nextRoundRobinOffset(c.env, {
      key: roundRobinKey,
      size: selected.length,
    }).catch(() => 0);

    selected = rotateByOffset(selected, offset);
  }

  if (selected.length === 0) {
    return c.json(
      {
        error: {
          message: 'No healthy free-tier model available',
          type: 'service_unavailable',
          code: 'no_candidate',
        },
      },
      503,
    );
  }

  let attemptCounter = 0;
  let chosenMeta: GatewayMeta | undefined;
  let finalResponse: Record<string, unknown> | null = null;
  let streamResponse: Response | null = null;
  let lastErrorClass = 'provider_fatal';
  let lastErrorMessage = 'Unknown error';

  await pRetry(
    async () => {
      const candidate = selected[attemptCounter];
      if (!candidate || attemptCounter >= 2) {
        throw new AbortError('No more candidates');
      }

      attemptCounter += 1;
      const startedAt = Date.now();

      try {
        const caller = providerCallers[candidate.provider];
        if (!caller) {
          throw new Error(`No caller for provider ${candidate.provider}`);
        }

        const providerResult = await caller({
          env: c.env,
          provider: candidate.provider,
          model: candidate.model,
          messages: normalized.messages,
          temperature: normalized.temperature,
          max_tokens: normalized.max_tokens,
          stream: normalized.stream,
        });

        const latencyMs = Date.now() - startedAt;
        const key = getModelKey(candidate.provider, candidate.model);

        await healthRecord(c.env, {
          key,
          success: true,
          latencyMs,
          now: Date.now(),
        });

        chosenMeta = buildGatewayMeta({
          provider: candidate.provider,
          model: candidate.model,
          attempts: attemptCounter,
          reasoning: normalized.reasoning_effort,
          requestId,
          projectId,
        });

        if (providerResult.stream && providerResult.streamSource) {
          const chunkDecoder = new TextDecoder();
          let workersSseBuffer = '';

          const writeWorkersChunk = async (writer: WritableStreamDefaultWriter<Uint8Array>, token: string) => {
            await writer.write(
              toSseData({
                id: `chatcmpl-${requestId}`,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: candidate.model,
                choices: [
                  {
                    index: 0,
                    delta: { content: token },
                    finish_reason: null,
                  },
                ],
              }),
            );
          };

          const processWorkersSseText = async (
            writer: WritableStreamDefaultWriter<Uint8Array>,
            text: string,
          ) => {
            workersSseBuffer += text;

            while (true) {
              const frameEnd = workersSseBuffer.indexOf('\n\n');
              if (frameEnd === -1) {
                break;
              }

              const frame = workersSseBuffer.slice(0, frameEnd).trim();
              workersSseBuffer = workersSseBuffer.slice(frameEnd + 2);
              if (!frame) {
                continue;
              }

              const dataLine = frame
                .split('\n')
                .find((line) => line.trimStart().startsWith('data:'));

              if (!dataLine) {
                continue;
              }

              const payloadText = dataLine.replace(/^data:\s*/, '').trim();
              if (!payloadText || payloadText === '[DONE]') {
                continue;
              }

              try {
                const payload = JSON.parse(payloadText) as {
                  response?: unknown;
                  delta?: { content?: unknown };
                  text?: unknown;
                };

                const token =
                  typeof payload.response === 'string'
                    ? payload.response
                    : typeof payload.delta?.content === 'string'
                      ? payload.delta.content
                      : typeof payload.text === 'string'
                        ? payload.text
                        : '';

                if (token) {
                  await writeWorkersChunk(writer, token);
                }
              } catch {
                // Ignore non-JSON frames from upstream Workers AI stream.
              }
            }
          };

          const stream = createSseStream(async (writer) => {
            for await (const chunk of providerResult.streamSource as AsyncIterable<unknown>) {
              if (candidate.provider === 'workers_ai') {
                if (chunk instanceof Uint8Array) {
                  const asText = chunkDecoder.decode(chunk, { stream: true });
                  await processWorkersSseText(writer, asText);
                  continue;
                }

                if (chunk instanceof ArrayBuffer) {
                  const bytes = new Uint8Array(chunk);
                  const asText = chunkDecoder.decode(bytes, { stream: true });
                  await processWorkersSseText(writer, asText);
                  continue;
                }

                const token =
                  typeof chunk === 'string'
                    ? chunk
                    : chunk && typeof chunk === 'object' && 'response' in chunk
                      ? String((chunk as { response?: unknown }).response ?? '')
                      : chunk &&
                          typeof chunk === 'object' &&
                          'delta' in chunk &&
                          (chunk as { delta?: { content?: unknown } }).delta?.content
                        ? String((chunk as { delta?: { content?: unknown } }).delta?.content ?? '')
                        : chunk && typeof chunk === 'object' && 'text' in chunk
                          ? String((chunk as { text?: unknown }).text ?? '')
                      : '';

                if (!token) {
                  continue;
                }

                await writeWorkersChunk(writer, token);
              } else {
                await writer.write(toSseData(chunk));
              }
            }
          });

          streamResponse = new Response(stream, {
            headers: {
              'content-type': 'text/event-stream; charset=utf-8',
              'cache-control': 'no-store',
              'x-gateway-provider': chosenMeta.provider,
              'x-gateway-model': chosenMeta.model,
              'x-gateway-attempts': String(chosenMeta.attempts),
              'x-gateway-request-id': chosenMeta.request_id,
            },
          });

          return;
        }

        const completion = (providerResult.completion as Record<string, unknown> | undefined) ?? {};

        if (isSafetyRefusal(completion)) {
          // Safety refusal counts as successful final response and should not trigger fallback.
        }

        finalResponse = {
          ...(completion.id ? completion : buildCompletionEnvelope({
            model: candidate.model,
            content:
              String(
                (completion.choices as Array<{ message?: { content?: unknown } }>)?.[0]?.message?.content ?? '',
              ) || '',
            requestId,
            gatewayMeta: chosenMeta,
          })),
          x_gateway: chosenMeta,
        };
      } catch (error) {
        const failureClass = classifyError(error);
        lastErrorClass = failureClass;
        lastErrorMessage = getErrorMessage(error);

        await healthRecord(c.env, {
          key: getModelKey(candidate.provider, candidate.model),
          success: false,
          latencyMs: Date.now() - startedAt,
          failureClass,
          now: Date.now(),
        });

        if (!isRetriableFailure(failureClass) || attemptCounter >= 2) {
          throw new AbortError(lastErrorMessage);
        }

        throw error instanceof Error ? error : new Error(lastErrorMessage);
      }
    },
    {
      retries: 1,
      minTimeout: 10,
      factor: 1,
    },
  ).catch(() => undefined);

  if (streamResponse) {
    console.log(
      JSON.stringify({
        request_id: requestId,
        project_id: projectId ?? null,
        provider: chosenMeta?.provider,
        model: chosenMeta?.model,
        attempts: chosenMeta?.attempts,
        stream: true,
      }),
    );

    return streamResponse;
  }

  if (finalResponse && chosenMeta) {
    console.log(
      JSON.stringify({
        request_id: requestId,
        project_id: projectId ?? null,
        provider: chosenMeta.provider,
        model: chosenMeta.model,
        attempts: chosenMeta.attempts,
        status: 'ok',
      }),
    );

    return c.json(finalResponse as never, 200);
  }

  const status = lastErrorClass === 'input_nonretriable' ? 400 : lastErrorClass === 'usage_retriable' ? 429 : 502;

  console.log(`[gateway] request=${requestId} lastError=${lastErrorMessage}`);
  return c.json(
    {
      error: {
        message: 'All providers failed',
        type: lastErrorClass,
      },
    },
    status,
  );
});

const responsesRoute = createRoute({
  method: 'post',
  path: '/v1/responses',
  request: {
    body: {
      content: {
        'application/json': {
          schema: responsesRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Responses API compatible response',
      content: {
        'application/json': {
          schema: responsesApiResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid input',
      content: {
        'application/json': { schema: errorSchema },
      },
    },
    429: {
      description: 'Rate limited',
      content: {
        'application/json': { schema: errorSchema },
      },
    },
    503: {
      description: 'No healthy free-tier model available',
      content: {
        'application/json': { schema: errorSchema },
      },
    },
  },
});

app.openapi(responsesRoute, async (c) => {
  const body = c.req.valid('json');
  const headerProjectId = c.req.header('x-gateway-project-id') ?? undefined;
  const projectId = resolveProjectId(headerProjectId, body.project_id);
  if (headerProjectId && !projectId) {
    return c.json(
      {
        error: {
          message: 'Invalid x-gateway-project-id. Use 1-64 chars [a-zA-Z0-9._:-]',
          type: 'invalid_request_error',
          code: 'invalid_project_id',
        },
      },
      400,
    );
  }

  if (body.stream) {
    return c.json(
      {
        error: {
          message: 'Streaming for /v1/responses is not implemented yet. Use /v1/chat/completions for streaming.',
          type: 'invalid_request_error',
          code: 'stream_not_supported',
        },
      },
      400,
    );
  }

  const prompt = responsesInputToPrompt(body.input);
  if (!prompt) {
    return c.json(
      {
        error: {
          message: '`input` must include text content',
          type: 'invalid_request_error',
          code: 'missing_input',
        },
      },
      400,
    );
  }

  const reasoningEffort = body.reasoning_effort ?? body.reasoning?.effort ?? 'auto';

  const headers = new Headers();
  headers.set('content-type', 'application/json');
  headers.set('x-gateway-source-endpoint', 'responses');
  headers.set('x-gateway-internal', '1');

  const authorization = c.req.header('authorization');
  if (authorization) {
    headers.set('authorization', authorization);
  }

  const forceProvider = c.req.header('x-gateway-force-provider');
  if (forceProvider) {
    headers.set('x-gateway-force-provider', forceProvider);
  }

  const forceModel = c.req.header('x-gateway-force-model');
  if (forceModel) {
    headers.set('x-gateway-force-model', forceModel);
  }

  if (projectId) {
    headers.set('x-gateway-project-id', projectId);
  }

  const proxiedRequest = new Request(new URL('/v1/chat/completions', c.req.url), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: body.model,
      prompt,
      stream: false,
      temperature: body.temperature,
      max_tokens: body.max_output_tokens,
      reasoning_effort: reasoningEffort,
      project_id: projectId,
    }),
  });

  const proxiedResponse = await app.fetch(proxiedRequest, c.env, c.executionCtx);
  const proxiedText = await proxiedResponse.text();

  if (!proxiedResponse.ok) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(proxiedText);
    } catch {
      parsed = undefined;
    }

    if (parsed && typeof parsed === 'object' && 'error' in (parsed as Record<string, unknown>)) {
      return c.json(parsed as never, proxiedResponse.status as 400 | 429 | 503);
    }

    return c.json(
      {
        error: {
          message: proxiedText || 'Upstream error',
          type: 'provider_fatal',
        },
      },
      proxiedResponse.status as 400 | 429 | 503,
    );
  }

  let parsedCompletion: Record<string, unknown>;
  try {
    parsedCompletion = JSON.parse(proxiedText) as Record<string, unknown>;
  } catch {
    return c.json(
      {
        error: {
          message: 'Invalid JSON returned by chat completion route',
          type: 'provider_fatal',
        },
      },
      503,
    );
  }

  return c.json(chatCompletionToResponsesObject(parsedCompletion) as never, 200);
});

const embeddingsRoute = createRoute({
  method: 'post',
  path: '/v1/embeddings',
  request: {
    body: {
      content: {
        'application/json': {
          schema: embeddingsRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Embeddings response',
      content: {
        'application/json': {
          schema: embeddingsResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid input',
      content: {
        'application/json': { schema: errorSchema },
      },
    },
    429: {
      description: 'Rate limited',
      content: {
        'application/json': { schema: errorSchema },
      },
    },
    503: {
      description: 'No embedding provider available',
      content: {
        'application/json': { schema: errorSchema },
      },
    },
    502: {
      description: 'Provider failure',
      content: {
        'application/json': { schema: errorSchema },
      },
    },
  },
});

app.openapi(embeddingsRoute, async (c) => {
  const requestStartedAt = Date.now();
  const body = c.req.valid('json');
  const requestId = createRequestId();
  const normalizedInput = normalizeEmbeddingInput(body.input);
  const inputChars = normalizedInput.reduce((sum, item) => sum + item.length, 0);
  const requestedEmbeddingModel = body.model.trim();
  const forcedProvider = getForcedEmbeddingProvider(c);
  const forcedModel = c.req.header('x-gateway-force-model') ?? undefined;
  const headerProjectId = c.req.header('x-gateway-project-id') ?? undefined;
  const projectId = resolveProjectId(headerProjectId, body.project_id);

  if (headerProjectId && !projectId) {
    return c.json(
      {
        error: {
          message: 'Invalid x-gateway-project-id. Use 1-64 chars [a-zA-Z0-9._:-]',
          type: 'invalid_request_error',
          code: 'invalid_project_id',
        },
      },
      400,
    );
  }

  if (!requestedEmbeddingModel || requestedEmbeddingModel.toLowerCase() === 'auto') {
    return c.json(
      {
        error: {
          message: '`model` is required for embeddings and cannot be "auto"',
          type: 'invalid_request_error',
          code: 'invalid_embedding_model',
        },
      },
      400,
    );
  }

  if (normalizedInput.length === 0) {
    return c.json(
      {
        error: {
          message: '`input` is required',
          type: 'invalid_request_error',
          code: 'missing_input',
        },
      },
      400,
    );
  }

  const candidates = resolveEmbeddingCandidates(c.env, {
    requestedModel: requestedEmbeddingModel,
    forcedProvider,
    forcedModel,
  });

  if (candidates.length === 0) {
    return c.json(
      {
        error: {
          message: 'No embedding provider is configured',
          type: 'configuration_error',
          code: 'no_embedding_provider',
        },
      },
      503,
    );
  }

  let attemptCounter = 0;
  let chosenMeta: GatewayMeta | undefined;
  let finalResponse: Record<string, unknown> | null = null;
  let lastErrorClass = 'provider_fatal';
  let lastErrorMessage = 'Unknown error';
  const maxEmbeddingAttempts = Math.max(1, candidates.length);

  await pRetry(
    async () => {
      const candidate = candidates[attemptCounter];
      if (!candidate || attemptCounter >= maxEmbeddingAttempts) {
        throw new AbortError('No more embedding candidates');
      }

      attemptCounter += 1;

      try {
        const caller = providerEmbeddingCallers[candidate.provider];
        if (!caller) {
          throw new Error(`No embedding caller for provider ${candidate.provider}`);
        }

        const result = await caller({
          env: c.env,
          provider: candidate.provider,
          model: candidate.model,
          input: normalizedInput,
          encoding_format: body.encoding_format,
          dimensions: body.dimensions,
        });

        chosenMeta = buildGatewayMeta({
          provider: candidate.provider,
          model: candidate.model,
          attempts: attemptCounter,
          reasoning: 'auto',
          requestId,
          projectId,
        });

        finalResponse = {
          ...result.response,
          x_gateway: chosenMeta,
        };
      } catch (error) {
        const failureClass = classifyError(error);
        lastErrorClass = failureClass;
        lastErrorMessage = getErrorMessage(error);

        if (!isRetriableFailure(failureClass) || attemptCounter >= maxEmbeddingAttempts) {
          throw new AbortError(lastErrorMessage);
        }

        throw error instanceof Error ? error : new Error(lastErrorMessage);
      }
    },
    {
      retries: maxEmbeddingAttempts - 1,
      minTimeout: 10,
      factor: 1,
    },
  ).catch(() => undefined);

  if (finalResponse && chosenMeta) {
    return c.json(finalResponse as never, 200);
  }

  const status = lastErrorClass === 'input_nonretriable' ? 400 : lastErrorClass === 'usage_retriable' ? 429 : 502;

  console.log(`[gateway] embeddings lastError=${lastErrorMessage}`);
  return c.json(
    {
      error: {
        message: 'All providers failed',
        type: lastErrorClass,
      },
    },
    status,
  );
});

const modelsRoute = createRoute({
  method: 'get',
  path: '/v1/models',
  responses: {
    200: {
      description: 'Models and routing status',
      content: {
        'application/json': {
          schema: z.object({ data: z.array(modelItemSchema) }),
        },
      },
    },
  },
});

app.openapi(modelsRoute, async (c) => {
  const registry = getModelRegistry(c.env);
  const limits = getProviderLimits(c.env);
  const keys = registry.map((candidate) => getModelKey(candidate.provider, candidate.model));

  const lookupLimits: Record<string, ProviderLimitConfig> = {};
  for (const candidate of registry) {
    const key = getModelKey(candidate.provider, candidate.model);
    lookupLimits[key] = limits[key] ?? { requestsPerDay: 200 };
  }

  const stateMap = await healthLookup(c.env, keys, lookupLimits, Date.now());

  const parallel = pLimit(8);
  const data = await Promise.all(
    registry.map((candidate) =>
      parallel(async () => {
        const snapshot = stateMap.get(getModelKey(candidate.provider, candidate.model));
        return {
          id: candidate.id,
          provider: candidate.provider,
          model: candidate.model,
          reasoning: candidate.reasoning,
          supports_streaming: candidate.supportsStreaming,
          cooldown_until: snapshot?.cooldownUntil ?? 0,
          success_rate: snapshot?.successRate ?? 0.5,
          headroom: snapshot?.headroom ?? 1,
          enabled: candidate.enabled,
        };
      }),
    ),
  );

  return c.json({ data });
});

const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  responses: {
    200: {
      description: 'Gateway health summary',
      content: {
        'application/json': {
          schema: healthSchema,
        },
      },
    },
  },
});

app.openapi(healthRoute, async (c) => {
  const snapshots = await healthSnapshot(c.env);
  return c.json({
    ok: true,
    models: snapshots.map((snapshot) => ({
      key: snapshot.key,
      attempts: snapshot.attempts,
      success_rate: snapshot.successRate,
      avg_latency_ms: snapshot.avgLatencyMs,
      cooldown_until: snapshot.cooldownUntil,
      headroom: snapshot.headroom,
      daily_used: snapshot.dailyUsed,
      daily_limit: snapshot.dailyLimit,
    })),
  });
});

app.doc('/openapi.json', {
  openapi: '3.0.0',
  info: {
    title: 'sass-maker AI Gateway API',
    version: '1.0.0',
    description:
      'OpenAI-compatible text gateway with health-aware free-tier routing across Workers AI, Groq, Gemini, Voyage AI embeddings, and optional OpenRouter/Cerebras.',
  },
});

app.get('/docs', swaggerUI({ url: '/openapi.json' }));

app.get('/', (c) => {
  return c.json({
    module: '@sass-maker/ai-gateway',
    version: '1.0.0',
    sass_maker: { type: 'api-gateway', category: 'ai' },
    endpoints: [
      '/v1/chat/completions',
      '/v1/responses',
      '/v1/embeddings',
      '/v1/models',
      '/health',
      '/openapi.json',
      '/docs',
    ],
    docs_url: c.env.DOCS_SITE_URL ?? null,
    openapi_url: '/openapi.json',
  });
});

export default app;
export { HealthStateDO, IpRateLimitDO };
