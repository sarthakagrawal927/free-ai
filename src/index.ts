import { swaggerUI } from '@hono/swagger-ui';
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import pLimit from 'p-limit';
import pRetry from 'p-retry';
import { AbortError } from 'p-retry';
import { getModelKey, getModelRegistry, getProviderLimits, getRateLimitConfig } from './config';
import { providerCallers, providerEmbeddingCallers } from './providers';
import { classifyError, isRetriableFailure } from './router/classify-error';
import { deriveRequiredCapabilities, selectCandidates } from './router/select-model';
import { consumeIpRateLimit, healthLookup, healthRecord, healthSnapshot, nextRoundRobinOffset } from './state/client';
import { HealthStateDO } from './state/health-do';
import { IpRateLimitDO } from './state/ip-rate-limit-do';
import { createSseStream, toSseData } from './utils/sse';
import { buildCompletionEnvelope, createRequestId, getErrorMessage, normalizeMessages } from './utils/request';
import type {
  ChatMessage,
  EmbeddingProvider,
  Env,
  GatewayMeta,
  ModelCandidate,
  NormalizedChatRequest,
  Provider,
  ProviderLimitConfig,
  ResponseFormat,
  TextProvider,
  Tool,
} from './types';

const app = new OpenAPIHono<{ Bindings: Env }>();

const contentPartTextSchema = z.object({
  type: z.literal('text'),
  text: z.string().min(1).max(100_000),
});

const contentPartImageUrlSchema = z.object({
  type: z.literal('image_url'),
  image_url: z.object({
    url: z.string().min(1),
    detail: z.enum(['auto', 'low', 'high']).optional(),
  }),
});

const contentSchema = z.union([
  z.string().min(1).max(100_000),
  z.array(z.union([contentPartTextSchema, contentPartImageUrlSchema])).min(1),
]);

const messageSchema = z
  .object({
    role: z.enum(['system', 'user', 'assistant', 'tool']),
    content: contentSchema,
    name: z.string().optional(),
  })
  .openapi('ChatMessage');

const projectIdSchema = z.string().min(1).max(64).regex(/^[a-zA-Z0-9._:-]+$/);

const toolFunctionSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  parameters: z.record(z.string(), z.unknown()).optional(),
});

const toolSchema = z.object({
  type: z.literal('function'),
  function: toolFunctionSchema,
});

const toolChoiceSchema = z.union([
  z.enum(['none', 'auto', 'required']),
  z.object({ type: z.literal('function'), function: z.object({ name: z.string() }) }),
]);

const responseFormatSchema = z.object({
  type: z.enum(['text', 'json_object']),
});

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
    tools: z.array(toolSchema).optional(),
    tool_choice: toolChoiceSchema.optional(),
    response_format: responseFormatSchema.optional(),
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
    provider: z.enum(['workers_ai', 'groq', 'gemini', 'voyage_ai', 'openrouter', 'cerebras', 'sambanova', 'nvidia', 'cli_bridge']),
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
    provider: 'voyage_ai',
    model: 'voyage-3-lite',
    priority: 0.88,
  },
  {
    provider: 'workers_ai',
    model: '@cf/baai/bge-large-en-v1.5',
    priority: 0.87,
  },
  {
    provider: 'workers_ai',
    model: '@cf/baai/bge-base-en-v1.5',
    priority: 0.85,
  },
  {
    provider: 'workers_ai',
    model: '@cf/baai/bge-small-en-v1.5',
    priority: 0.80,
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

  if (['workers_ai', 'groq', 'gemini', 'openrouter', 'cerebras', 'sambanova', 'nvidia', 'cli_bridge'].includes(value)) {
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
  const promptChars = normalizedMessages.reduce((sum, message) => {
    if (typeof message.content === 'string') {
      return sum + message.content.length;
    }
    return sum + JSON.stringify(message.content).length;
  }, 0);

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
    tools: body.tools as Tool[] | undefined,
    tool_choice: body.tool_choice as NormalizedChatRequest['tool_choice'],
    response_format: body.response_format as ResponseFormat | undefined,
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
  const requiredCapabilities = deriveRequiredCapabilities({
    tools: normalized.tools,
    response_format: normalized.response_format,
    messages: normalized.messages,
  });

  let selected = selectCandidates(registry, stateMap, {
    requestedReasoning: normalized.reasoning_effort,
    stream: normalized.stream,
    now,
    modelOverride: forcedModel,
    requiredCapabilities,
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
          tools: normalized.tools,
          tool_choice: normalized.tool_choice,
          response_format: normalized.response_format,
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

// ── Speech-to-Text (Groq Whisper proxy) ─────────────────────────────
app.post('/v1/audio/transcriptions', async (c) => {
  if (!c.env.GROQ_API_KEY) {
    return c.json(
      { error: { message: 'Speech-to-text requires GROQ_API_KEY', type: 'configuration_error' } },
      503,
    );
  }

  const formData = await c.req.formData();
  const file = formData.get('file');

  if (!file || typeof file === 'string') {
    return c.json(
      {
        error: {
          message: '`file` is required (audio file: mp3, mp4, wav, webm, m4a)',
          type: 'invalid_request_error',
          code: 'missing_file',
        },
      },
      400,
    );
  }

  const model = (formData.get('model') as string) || 'whisper-large-v3-turbo';
  const language = formData.get('language') as string | null;

  const groqForm = new FormData();
  groqForm.append('file', file, (file as File).name || 'audio.mp3');
  groqForm.append('model', model);
  if (language) groqForm.append('language', language);

  const groqResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${c.env.GROQ_API_KEY}` },
    body: groqForm,
  });

  if (!groqResponse.ok) {
    const errBody = await groqResponse.text();
    const statusCode = groqResponse.status >= 500 ? 502 : groqResponse.status === 429 ? 429 : 400;
    return c.json(
      { error: { message: `Groq Whisper error: ${errBody}`, type: 'provider_error' } },
      statusCode as 400,
    );
  }

  const result = await groqResponse.json();
  return c.json(result as never, 200);
});

// ── Speech-to-Speech (STT → LLM → TTS pipeline) ────────────────────
app.post('/v1/audio/speech-to-speech', async (c) => {
  if (!c.env.GROQ_API_KEY) {
    return c.json(
      { error: { message: 'Speech-to-speech requires GROQ_API_KEY', type: 'configuration_error' } },
      503,
    );
  }

  const formData = await c.req.formData();
  const file = formData.get('file');

  if (!file || typeof file === 'string') {
    return c.json(
      {
        error: {
          message: '`file` is required (audio file: mp3, mp4, wav, webm, m4a)',
          type: 'invalid_request_error',
          code: 'missing_file',
        },
      },
      400,
    );
  }

  const voice = (formData.get('voice') as string) || 'en-US-AriaNeural';
  const systemPrompt = formData.get('system_prompt') as string | null;

  // Step 1: Speech-to-Text via Groq Whisper
  const sttForm = new FormData();
  sttForm.append('file', file, (file as File).name || 'audio.mp3');
  sttForm.append('model', 'whisper-large-v3-turbo');

  const sttResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${c.env.GROQ_API_KEY}` },
    body: sttForm,
  });

  if (!sttResponse.ok) {
    const errBody = await sttResponse.text();
    return c.json(
      { error: { message: `STT failed: ${errBody}`, type: 'provider_error', code: 'stt_failed' } },
      502,
    );
  }

  const sttResult = (await sttResponse.json()) as { text: string };
  const transcribedText = sttResult.text;

  if (!transcribedText?.trim()) {
    return c.json(
      { error: { message: 'No speech detected in audio', type: 'invalid_request_error', code: 'no_speech' } },
      400,
    );
  }

  // Step 2: LLM response via gateway providers (Groq primary, Gemini fallback)
  const messages: ChatMessage[] = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: transcribedText });

  let llmText: string;
  try {
    const llmResult = await providerCallers.groq({
      env: c.env,
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      messages,
      stream: false,
    });
    llmText = llmResult.completion?.choices?.[0]?.message?.content || '';
  } catch {
    try {
      const llmResult = await providerCallers.gemini({
        env: c.env,
        provider: 'gemini',
        model: 'gemini-2.0-flash',
        messages,
        stream: false,
      });
      llmText = llmResult.completion?.choices?.[0]?.message?.content || '';
    } catch (fallbackErr) {
      return c.json(
        { error: { message: `LLM failed: ${getErrorMessage(fallbackErr)}`, type: 'provider_error', code: 'llm_failed' } },
        502,
      );
    }
  }

  if (!llmText?.trim()) {
    return c.json(
      { error: { message: 'LLM returned empty response', type: 'provider_error', code: 'empty_llm_response' } },
      502,
    );
  }

  // Step 3: Text-to-Speech via Workers AI
  if (!c.env.AI) {
    return c.json(
      { error: { message: 'TTS requires Workers AI binding', type: 'configuration_error' } },
      503,
    );
  }

  try {
    const ttsResult = (await c.env.AI.run('@cf/myshell-ai/melotts', {
      prompt: llmText,
      lang: 'en',
    })) as { audio: string };

    const binaryString = atob(ttsResult.audio);
    const audioBytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      audioBytes[i] = binaryString.charCodeAt(i);
    }

    return new Response(audioBytes.buffer as ArrayBuffer, {
      headers: {
        'content-type': 'audio/mpeg',
        'x-transcribed-text': encodeURIComponent(transcribedText),
        'x-llm-response': encodeURIComponent(llmText.slice(0, 500)),
      },
    });
  } catch (ttsErr) {
    return c.json(
      { error: { message: `TTS failed: ${getErrorMessage(ttsErr)}`, type: 'provider_error', code: 'tts_failed' } },
      502,
    );
  }
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
      'OpenAI-compatible AI gateway with health-aware free-tier routing across Workers AI, Groq, Gemini, Voyage AI embeddings, voice (Whisper STT + Workers AI TTS), and optional OpenRouter/Cerebras.',
  },
});

app.get('/docs', swaggerUI({ url: '/openapi.json' }));

app.get('/', (c) => {
  const models = getModelRegistry(c.env).filter((m) => m.provider !== 'cli_bridge');
  const providers = new Set(models.map((m) => m.provider));
  const tierOrder = ['high', 'medium', 'low'] as const;
  const tierLabels: Record<string, string> = { high: 'High Reasoning', medium: 'Medium Reasoning', low: 'Low Reasoning (fastest)' };
  const tierColors: Record<string, string> = { high: '#34d399', medium: '#60a5fa', low: '#9ca3af' };
  const providerLabels: Record<string, string> = { workers_ai: 'Workers AI', groq: 'Groq', gemini: 'Gemini', openrouter: 'OpenRouter', cerebras: 'Cerebras' };

  const modelRows = tierOrder.map((tier) => {
    const tierModels = models.filter((m) => m.reasoning === tier);
    if (tierModels.length === 0) return '';
    const header = `<tr><td colspan="4" style="color:${tierColors[tier]};font-weight:600;font-size:0.78rem;padding:12px 12px 4px;border:none;text-transform:uppercase;letter-spacing:0.05em">${tierLabels[tier]}</td></tr>`;
    const rows = tierModels.map((m) =>
      `<tr><td class="mono">${m.id}</td><td class="provider">${providerLabels[m.provider] ?? m.provider}</td><td class="mono">${m.model}</td><td><span class="tier tier-${tier}">${tier}</span></td></tr>`
    ).join('\n        ');
    return `${header}\n        ${rows}`;
  }).join('\n        ');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Free AI Gateway - SaaS Maker</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0a0f;color:#e0e0e8;line-height:1.6;min-height:100vh}
  .container{max-width:860px;margin:0 auto;padding:48px 24px}
  h1{font-size:2.4rem;font-weight:700;background:linear-gradient(135deg,#6366f1,#a78bfa,#818cf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:8px}
  .subtitle{color:#9ca3af;font-size:1.1rem;margin-bottom:12px}
  .badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:32px}
  .badge-internal{background:rgba(251,191,36,0.15);color:#fbbf24;border:1px solid rgba(251,191,36,0.3)}
  .card{background:#12121a;border:1px solid #1e1e2e;border-radius:12px;padding:24px;margin-bottom:20px}
  .card h2{font-size:1.1rem;font-weight:600;color:#c4b5fd;margin-bottom:16px;display:flex;align-items:center;gap:8px}
  .card h2 span{font-size:1.2rem}
  table{width:100%;border-collapse:collapse;font-size:0.88rem}
  th{text-align:left;padding:8px 12px;color:#9ca3af;font-weight:500;border-bottom:1px solid #1e1e2e;font-size:0.78rem;text-transform:uppercase;letter-spacing:0.04em}
  td{padding:8px 12px;border-bottom:1px solid #16161f}
  .mono{font-family:'SF Mono',SFMono-Regular,Consolas,monospace;font-size:0.82rem;color:#a5b4fc}
  .provider{color:#9ca3af;font-size:0.8rem}
  .tier{padding:2px 8px;border-radius:4px;font-size:0.75rem;font-weight:500}
  .tier-high{background:rgba(52,211,153,0.15);color:#34d399}
  .tier-medium{background:rgba(96,165,250,0.15);color:#60a5fa}
  .tier-low{background:rgba(156,163,175,0.15);color:#9ca3af}
  .links{display:flex;flex-wrap:wrap;gap:10px;margin-top:24px}
  .links a{display:inline-flex;align-items:center;gap:6px;padding:10px 18px;border-radius:8px;text-decoration:none;font-size:0.88rem;font-weight:500;transition:all 0.15s ease}
  .link-primary{background:#6366f1;color:#fff}
  .link-primary:hover{background:#818cf8}
  .link-secondary{background:#1e1e2e;color:#c4b5fd;border:1px solid #2e2e3e}
  .link-secondary:hover{background:#252535}
  .section-desc{color:#9ca3af;font-size:0.88rem;margin-bottom:16px}
  .does{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:8px}
  @media(max-width:600px){.does{grid-template-columns:1fr}}
  .does-col h3{font-size:0.85rem;font-weight:600;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.04em}
  .does-col.yes h3{color:#34d399}
  .does-col.no h3{color:#f87171}
  .does-col ul{list-style:none;font-size:0.85rem;color:#d1d5db}
  .does-col ul li{padding:3px 0}
  .does-col ul li::before{content:'';display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:8px;position:relative;top:-1px}
  .does-col.yes ul li::before{background:#34d399}
  .does-col.no ul li::before{background:#f87171}
  .code-block{background:#0d0d14;border:1px solid #1e1e2e;border-radius:8px;padding:16px;font-family:'SF Mono',SFMono-Regular,Consolas,monospace;font-size:0.82rem;color:#c4b5fd;overflow-x:auto;margin-top:16px;white-space:pre;line-height:1.5}
  .footer{margin-top:40px;padding-top:20px;border-top:1px solid #1e1e2e;color:#6b7280;font-size:0.8rem;text-align:center}
  .footer a{color:#818cf8;text-decoration:none}
</style>
</head>
<body>
<div class="container">
  <h1>Free AI Gateway</h1>
  <p class="subtitle">OpenAI-compatible proxy with health-aware routing across free-tier providers</p>
  <span class="badge badge-internal">Internal Use Only</span>

  <div class="card">
    <h2><span>&#x1f4ac;</span> Chat Models &mdash; ${models.length} models across ${providers.size} providers</h2>
    <p class="section-desc">Health-aware routing picks the best available model per reasoning tier. Providers auto-activate when their API key is present.</p>
    <table>
      <thead><tr><th>Model ID</th><th>Provider</th><th>Actual Model</th><th>Tier</th></tr></thead>
      <tbody>
        ${modelRows}
      </tbody>
    </table>
  </div>


  <div class="card">
    <h2><span>&#x1f9e9;</span> Embedding Models &mdash; 6 models across 3 providers</h2>
    <p class="section-desc">Automatic failover with OpenAI-compatible aliases.</p>
    <table>
      <thead><tr><th>Model ID</th><th>Provider</th><th>Notes</th></tr></thead>
      <tbody>
        <tr><td class="mono">gemini-embedding-001</td><td class="provider">Gemini</td><td style="font-size:0.82rem;color:#9ca3af">Default. Aliases: text-embedding-3-small, text-embedding-3-large, text-embedding-004</td></tr>
        <tr><td class="mono">voyage-3.5-lite</td><td class="provider">Voyage AI</td><td style="font-size:0.82rem;color:#9ca3af">Fallback #1</td></tr>
        <tr><td class="mono">voyage-3-lite</td><td class="provider">Voyage AI</td><td style="font-size:0.82rem;color:#9ca3af">Fallback #2</td></tr>
        <tr><td class="mono">@cf/baai/bge-large-en-v1.5</td><td class="provider">Workers AI</td><td style="font-size:0.82rem;color:#9ca3af">768-dim, largest</td></tr>
        <tr><td class="mono">@cf/baai/bge-base-en-v1.5</td><td class="provider">Workers AI</td><td style="font-size:0.82rem;color:#9ca3af">768-dim, balanced</td></tr>
        <tr><td class="mono">@cf/baai/bge-small-en-v1.5</td><td class="provider">Workers AI</td><td style="font-size:0.82rem;color:#9ca3af">384-dim, fastest</td></tr>
      </tbody>
    </table>
  </div>

  <div class="card">
    <h2><span>&#x1f3a4;</span> Voice &mdash; Speech-to-Text &amp; Speech-to-Speech</h2>
    <p class="section-desc">Groq Whisper for transcription, Workers AI MeloTTS for synthesis. Fully free.</p>
    <table>
      <thead><tr><th>Endpoint</th><th>Method</th><th>Description</th></tr></thead>
      <tbody>
        <tr><td class="mono">/v1/audio/transcriptions</td><td class="provider">POST</td><td style="font-size:0.82rem;color:#9ca3af">Speech-to-text via Groq Whisper (OpenAI-compatible)</td></tr>
        <tr><td class="mono">/v1/audio/speech-to-speech</td><td class="provider">POST</td><td style="font-size:0.82rem;color:#9ca3af">Audio in &rarr; Groq Whisper &rarr; LLM &rarr; Workers AI TTS &rarr; Audio out</td></tr>
      </tbody>
    </table>
  </div>

  <div class="card">
    <h2><span>&#x26a1;</span> What This Does &amp; Doesn't Do</h2>
    <div class="does">
      <div class="does-col yes">
        <h3>Does</h3>
        <ul>
          <li>OpenAI-compatible /v1/chat/completions</li>
          <li>OpenAI-compatible /v1/embeddings</li>
          <li>Speech-to-text (Groq Whisper)</li>
          <li>Speech-to-speech (STT + LLM + TTS)</li>
          <li>Streaming (SSE) support</li>
          <li>Health-aware provider failover</li>
          <li>IP-based rate limiting (10 burst, ~20/min)</li>
          <li>Reasoning tier routing (low/medium/high)</li>
        </ul>
      </div>
      <div class="does-col no">
        <h3>Doesn't Do</h3>
        <ul>
          <li>No authentication required</li>
          <li>No request logging or storage</li>
          <li>No API key management</li>
          <li>No usage billing or quotas</li>
          <li>No SLA or uptime guarantee</li>
          <li>No image models</li>
        </ul>
      </div>
    </div>
  </div>

  <div class="card">
    <h2><span>&#x1f680;</span> Quick Start</h2>
    <div class="code-block">curl https://free-ai-gateway.sarthakagrawal927.workers.dev/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer anything" \\
  -d '{
    "model": "groq-llama-70b",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'</div>
  </div>

  <div class="links">
    <a href="/docs" class="link-primary">API Docs (Swagger)</a>
    <a href="/v1/models" class="link-secondary">Live Models</a>
    <a href="/health" class="link-secondary">Health Status</a>
    <a href="/openapi.json" class="link-secondary">OpenAPI Spec</a>
  </div>

  <div class="footer">
    Powered by <a href="https://sassmaker.com">SaaS Maker</a> &middot; Free-tier AI gateway for internal tools and prototyping
  </div>
</div>
</body>
</html>`;
  return c.html(html);
});

export default app;
export { HealthStateDO, IpRateLimitDO };
