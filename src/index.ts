import { swaggerUI } from '@hono/swagger-ui';
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import pLimit from 'p-limit';
import pRetry from 'p-retry';
import { AbortError } from 'p-retry';
import {
  getImageRegistry,
  getModelKey,
  getModelRegistry,
  getProviderLimits,
  getRateLimitConfig,
  getSttRegistry,
  getTtsRegistry,
  getVideoRegistry,
  hasImageProviderKey,
  hasSttProviderKey,
  hasTtsProviderKey,
  hasVideoProviderKey,
} from './config';
import {
  imageProviderCallers,
  providerCallers,
  providerEmbeddingCallers,
  sttProviderCallers,
  ttsProviderCallers,
  videoProviderCallers,
} from './providers';
import { classifyError, isRetriableFailure } from './router/classify-error';
import { deriveRequiredCapabilities, selectCandidates } from './router/select-model';
import { consumeIpRateLimit, healthLookup, healthRecord, healthSnapshot, nextRoundRobinOffset, providerStats } from './state/client';
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
  VideoProvider,
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
    provider: z.string(),
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

const analyticsBreakdownSchema = z.object({
  requests: z.number(),
  successful: z.number(),
  failed: z.number(),
});

const analyticsResponseSchema = z.object({
  total_requests: z.number(),
  successful_requests: z.number(),
  failed_requests: z.number(),
  success_rate: z.number(),
  providers: z.record(z.string(), analyticsBreakdownSchema),
  models: z.record(z.string(), analyticsBreakdownSchema),
  projects: z.record(z.string(), analyticsBreakdownSchema),
  daily: z.array(
    z.object({
      date: z.string(),
      requests: z.number(),
      successful: z.number(),
      failed: z.number(),
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

// Paths exempt from IP rate limiting — public read-only endpoints
const RATE_LIMIT_EXEMPT_GET = new Set([
  '/v1/analytics',
  '/v1/stats/providers',
  '/v1/models',
  '/v1/dashboard',
]);

app.use('/v1/*', async (c, next) => {
  if (c.req.method === 'GET' && RATE_LIMIT_EXEMPT_GET.has(new URL(c.req.url).pathname)) {
    return next();
  }

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

  if (['workers_ai', 'groq', 'gemini', 'openrouter', 'cerebras', 'sambanova', 'nvidia'].includes(value)) {
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

async function recordAnalytics(params: {
  db: D1Database;
  projectId?: string;
  outcome: 'ok' | 'error';
  provider?: Provider;
  model?: string;
}) {
  if (!params.projectId || !params.provider || !params.model) return;

  try {
    const date = new Date().toISOString().slice(0, 10);
    const isOk = params.outcome === 'ok' ? 1 : 0;
    const isError = params.outcome === 'error' ? 1 : 0;
    
    await params.db.prepare(`
      INSERT INTO project_analytics (project_id, date, provider, model, total_requests, successful_requests, failed_requests)
      VALUES (?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(project_id, date, provider, model) DO UPDATE SET
        total_requests = total_requests + 1,
        successful_requests = successful_requests + excluded.successful_requests,
        failed_requests = failed_requests + excluded.failed_requests
    `).bind(params.projectId, date, params.provider, params.model, isOk, isError).run();
  } catch (err) {
    // Ignore analytics errors
  }
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
  if (!explicitProjectId) {
    return c.json(
      {
        error: {
          message: 'Missing or invalid project_id. Use 1-64 chars [a-zA-Z0-9._:-]',
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
    if (!c.req.header('x-gateway-internal')) {
      c.executionCtx.waitUntil(
        recordAnalytics({
          db: c.env.GATEWAY_DB,
          projectId,
          outcome: 'error',
        })
      );
    }

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
    if (!c.req.header('x-gateway-internal')) {
      c.executionCtx.waitUntil(
        recordAnalytics({
          db: c.env.GATEWAY_DB,
          projectId,
          outcome: 'ok',
          provider: chosenMeta?.provider,
          model: chosenMeta?.model,
        })
      );
    }

    return streamResponse;
  }

  if (finalResponse && chosenMeta) {
    if (!c.req.header('x-gateway-internal')) {
      c.executionCtx.waitUntil(
        recordAnalytics({
          db: c.env.GATEWAY_DB,
          projectId,
          outcome: 'ok',
          provider: chosenMeta.provider,
          model: chosenMeta.model,
        })
      );
    }

    return c.json(finalResponse as never, 200);
  }

  const status = lastErrorClass === 'input_nonretriable' ? 400 : lastErrorClass === 'usage_retriable' ? 429 : 502;

  if (!c.req.header('x-gateway-internal')) {
    c.executionCtx.waitUntil(
      recordAnalytics({
        db: c.env.GATEWAY_DB,
        projectId,
        outcome: 'error',
        provider: chosenMeta?.provider,
        model: chosenMeta?.model,
      })
    );
  }

  return c.json(
    {
      error: {
        message: `All providers failed: ${lastErrorMessage}`,
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
  if (!projectId) {
    return c.json(
      {
        error: {
          message: 'Missing or invalid project_id. Use 1-64 chars [a-zA-Z0-9._:-]',
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

  if (!projectId) {
    return c.json(
      {
        error: {
          message: 'Missing or invalid project_id. Use 1-64 chars [a-zA-Z0-9._:-]',
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
    c.executionCtx.waitUntil(
      recordAnalytics({
        db: c.env.GATEWAY_DB,
        projectId,
        outcome: 'ok',
        provider: chosenMeta.provider,
        model: chosenMeta.model,
      })
    );
    return c.json(finalResponse as never, 200);
  }

  const status = lastErrorClass === 'input_nonretriable' ? 400 : lastErrorClass === 'usage_retriable' ? 429 : 502;

  c.executionCtx.waitUntil(
    recordAnalytics({
      db: c.env.GATEWAY_DB,
      projectId,
      outcome: 'error',
      provider: chosenMeta?.provider,
      model: chosenMeta?.model,
    })
  );

  return c.json(
    {
      error: {
        message: `All embedding providers failed: ${lastErrorMessage}`,
        type: lastErrorClass,
      },
    },
    status,
  );
});

// ── Speech-to-Text (health-aware routing across providers) ─────────
app.post('/v1/audio/transcriptions', async (c) => {
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

  const headerProjectId = c.req.header('x-gateway-project-id') ?? undefined;
  const bodyProjectId = (formData.get('project_id') as string | null) ?? undefined;
  const projectId = resolveProjectId(headerProjectId, bodyProjectId);
  if (!projectId) {
    return c.json(
      {
        error: {
          message: 'Missing or invalid project_id. Use 1-64 chars [a-zA-Z0-9._:-]',
          type: 'invalid_request_error',
          code: 'invalid_project_id',
        },
      },
      400,
    );
  }

  const requestedModel = ((formData.get('model') as string) || 'auto').trim();
  const language = (formData.get('language') as string | null) ?? undefined;
  const forcedProvider = c.req.header('x-gateway-force-provider') ?? undefined;

  const registry = getSttRegistry(c.env).filter((cand) => {
    if (forcedProvider && cand.provider !== forcedProvider) return false;
    if (requestedModel && requestedModel !== 'auto' && cand.model !== requestedModel) return false;
    return true;
  });

  if (registry.length === 0) {
    return c.json(
      {
        error: {
          message: 'Speech-to-text unavailable: no configured STT provider (need GROQ_API_KEY, GEMINI_API_KEY, or Workers AI binding)',
          type: 'configuration_error',
          code: 'no_stt_provider',
        },
      },
      503,
    );
  }

  const sorted = [...registry].sort((a, b) => b.priority - a.priority);

  let lastError = 'Unknown error';
  let chosenProvider: string | undefined;
  let chosenModel: string | undefined;

  for (const cand of sorted) {
    chosenProvider = cand.provider;
    chosenModel = cand.model;

    try {
      if (cand.provider === 'groq') {
        const groqForm = new FormData();
        groqForm.append('file', file, (file as File).name || 'audio.mp3');
        groqForm.append('model', cand.model);
        if (language) groqForm.append('language', language);

        const groqResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${c.env.GROQ_API_KEY}` },
          body: groqForm,
        });

        if (!groqResponse.ok) {
          lastError = `Groq STT error (${groqResponse.status}): ${await groqResponse.text()}`;
          continue;
        }

        const result = (await groqResponse.json()) as Record<string, unknown>;
        c.executionCtx.waitUntil(
          recordAnalytics({ db: c.env.GATEWAY_DB, projectId, outcome: 'ok', provider: 'groq', model: cand.model }),
        );
        return c.json(
          {
            ...result,
            x_gateway: { provider: 'groq', model: cand.model, attempts: 1, reasoning_effort: 'auto' as const, request_id: createRequestId(), project_id: projectId },
          } as never,
          200,
        );
      }

      const caller = sttProviderCallers[cand.provider as 'workers_ai' | 'gemini'];
      const result = await caller({
        env: c.env,
        model: cand.model,
        file: file as File,
        language,
      });

      c.executionCtx.waitUntil(
        recordAnalytics({ db: c.env.GATEWAY_DB, projectId, outcome: 'ok', provider: cand.provider, model: cand.model }),
      );

      return c.json(
        {
          text: result.text,
          language: result.language,
          duration: result.duration,
          x_gateway: { provider: cand.provider, model: cand.model, attempts: 1, reasoning_effort: 'auto' as const, request_id: createRequestId(), project_id: projectId },
        } as never,
        200,
      );
    } catch (err) {
      lastError = getErrorMessage(err);
      continue;
    }
  }

  c.executionCtx.waitUntil(
    recordAnalytics({ db: c.env.GATEWAY_DB, projectId, outcome: 'error', provider: chosenProvider as Provider | undefined, model: chosenModel }),
  );
  return c.json(
    { error: { message: `All STT providers failed: ${lastError}`, type: 'provider_error' } },
    502,
  );
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

// ═══════════════════════════════════════════════════════════════════
// Multi-modal endpoints: image, video, TTS
// ═══════════════════════════════════════════════════════════════════

// ── Schemas ────────────────────────────────────────────────────────
const imageGenRequestSchema = z
  .object({
    model: z.string().default('auto'),
    prompt: z.string().min(1).max(8000),
    n: z.number().int().min(1).max(4).optional(),
    size: z.enum(['256x256', '512x512', '1024x1024', '1024x1792', '1792x1024']).optional(),
    response_format: z.enum(['url', 'b64_json']).optional(),
    quality: z.string().optional(),
    style: z.string().optional(),
    project_id: projectIdSchema.optional(),
  })
  .openapi('ImageGenerationRequest');

const imageGenResponseSchema = z
  .object({
    created: z.number(),
    data: z.array(
      z.object({
        url: z.string().optional(),
        b64_json: z.string().optional(),
        revised_prompt: z.string().optional(),
      }),
    ),
    x_gateway: gatewayMetaSchema.optional(),
  })
  .openapi('ImageGenerationResponse');

const videoGenRequestSchema = z
  .object({
    model: z.string().default('auto'),
    prompt: z.string().min(1).max(8000),
    duration_seconds: z.number().int().min(1).max(60).optional(),
    aspect_ratio: z.enum(['16:9', '9:16', '1:1']).optional(),
    image_url: z.string().url().optional(),
    project_id: projectIdSchema.optional(),
  })
  .openapi('VideoGenerationRequest');

const videoGenResponseSchema = z
  .object({
    id: z.string(),
    status: z.enum(['processing', 'completed', 'failed']),
    video_url: z.string().optional(),
    poll_url: z.string().optional(),
    error: z.string().optional(),
    x_gateway: gatewayMetaSchema.optional(),
  })
  .openapi('VideoGenerationResponse');

const ttsRequestSchema = z
  .object({
    model: z.string().default('auto'),
    input: z.string().min(1).max(10_000),
    voice: z.string().optional(),
    response_format: z.enum(['mp3', 'wav', 'opus', 'flac']).optional(),
    speed: z.number().min(0.25).max(4.0).optional(),
    project_id: projectIdSchema.optional(),
  })
  .openapi('TtsRequest');

// ── /v1/images/generations ─────────────────────────────────────────
const imagesGenRoute = createRoute({
  method: 'post',
  path: '/v1/images/generations',
  request: {
    body: { content: { 'application/json': { schema: imageGenRequestSchema } } },
  },
  responses: {
    200: { description: 'Image generated', content: { 'application/json': { schema: imageGenResponseSchema } } },
    400: { description: 'Invalid input', content: { 'application/json': { schema: errorSchema } } },
    502: { description: 'All providers failed', content: { 'application/json': { schema: errorSchema } } },
    503: { description: 'No image provider configured', content: { 'application/json': { schema: errorSchema } } },
  },
});

app.openapi(imagesGenRoute, async (c) => {
  const body = c.req.valid('json');
  const requestId = createRequestId();
  const headerProjectId = c.req.header('x-gateway-project-id') ?? undefined;
  const projectId = resolveProjectId(headerProjectId, body.project_id);
  if (!projectId) {
    return c.json(
      { error: { message: 'Missing or invalid project_id. Use 1-64 chars [a-zA-Z0-9._:-]', type: 'invalid_request_error', code: 'invalid_project_id' } },
      400,
    );
  }

  const forcedProvider = c.req.header('x-gateway-force-provider') ?? undefined;
  const requestedModel = body.model.trim();
  const requestedLower = requestedModel.toLowerCase();

  const registry = getImageRegistry(c.env).filter((cand) => {
    if (forcedProvider && cand.provider !== forcedProvider) return false;
    if (requestedModel && requestedLower !== 'auto' && cand.model !== requestedModel && cand.id !== requestedModel) return false;
    if (!hasImageProviderKey(c.env, cand.provider)) return false;
    return true;
  });

  if (registry.length === 0) {
    return c.json(
      {
        error: {
          message: 'Image generation unavailable: no Together/Gemini/NVIDIA key and Workers AI binding missing',
          type: 'configuration_error',
          code: 'no_image_provider',
        },
      },
      503,
    );
  }

  const sorted = [...registry].sort((a, b) => b.priority - a.priority);
  let lastError = 'Unknown error';
  let attempts = 0;
  let chosenProvider: string | undefined;
  let chosenModel: string | undefined;

  for (const cand of sorted.slice(0, 3)) {
    attempts += 1;
    chosenProvider = cand.provider;
    chosenModel = cand.model;

    try {
      const caller = imageProviderCallers[cand.provider];
      const result = await caller({
        env: c.env,
        model: cand.model,
        prompt: body.prompt,
        n: body.n,
        size: body.size,
        response_format: body.response_format,
      });

      c.executionCtx.waitUntil(
        recordAnalytics({ db: c.env.GATEWAY_DB, projectId, outcome: 'ok', provider: cand.provider, model: cand.model }),
      );

      return c.json(
        {
          created: result.created,
          data: result.data,
          x_gateway: {
            provider: cand.provider,
            model: cand.model,
            attempts,
            reasoning_effort: 'auto' as const,
            request_id: requestId,
            project_id: projectId,
          },
        } as never,
        200,
      );
    } catch (err) {
      lastError = getErrorMessage(err);
      continue;
    }
  }

  c.executionCtx.waitUntil(
    recordAnalytics({ db: c.env.GATEWAY_DB, projectId, outcome: 'error', provider: chosenProvider as Provider | undefined, model: chosenModel }),
  );

  return c.json(
    { error: { message: `All image providers failed: ${lastError}`, type: 'provider_error' } },
    502,
  );
});

// ── /v1/videos/generations (async: submit) ──────────────────────────
const videosGenRoute = createRoute({
  method: 'post',
  path: '/v1/videos/generations',
  request: {
    body: { content: { 'application/json': { schema: videoGenRequestSchema } } },
  },
  responses: {
    202: { description: 'Video job submitted', content: { 'application/json': { schema: videoGenResponseSchema } } },
    200: { description: 'Video completed synchronously', content: { 'application/json': { schema: videoGenResponseSchema } } },
    400: { description: 'Invalid input', content: { 'application/json': { schema: errorSchema } } },
    502: { description: 'Provider failure', content: { 'application/json': { schema: errorSchema } } },
    503: { description: 'No video provider', content: { 'application/json': { schema: errorSchema } } },
  },
});

app.openapi(videosGenRoute, async (c) => {
  const body = c.req.valid('json');
  const requestId = createRequestId();
  const headerProjectId = c.req.header('x-gateway-project-id') ?? undefined;
  const projectId = resolveProjectId(headerProjectId, body.project_id);
  if (!projectId) {
    return c.json(
      { error: { message: 'Missing or invalid project_id. Use 1-64 chars [a-zA-Z0-9._:-]', type: 'invalid_request_error', code: 'invalid_project_id' } },
      400,
    );
  }

  const requestedModel = body.model.trim();
  const requestedLower = requestedModel.toLowerCase();

  const registry = getVideoRegistry(c.env).filter((cand) => {
    if (requestedModel && requestedLower !== 'auto' && cand.model !== requestedModel && cand.id !== requestedModel) return false;
    if (!hasVideoProviderKey(c.env, cand.provider)) return false;
    return true;
  });

  if (registry.length === 0) {
    return c.json(
      {
        error: {
          message: 'Video generation unavailable: TOGETHER_API_KEY not configured or model not found',
          type: 'configuration_error',
          code: 'no_video_provider',
        },
      },
      503,
    );
  }

  const chosen = registry.sort((a, b) => b.priority - a.priority)[0];

  try {
    const submitter = videoProviderCallers[chosen.provider].submit;
    const job = await submitter({
      env: c.env,
      model: chosen.model,
      prompt: body.prompt,
      duration_seconds: body.duration_seconds,
      aspect_ratio: body.aspect_ratio,
      image_url: body.image_url,
    });

    const statusCode = job.status === 'completed' ? 200 : 202;

    c.executionCtx.waitUntil(
      recordAnalytics({
        db: c.env.GATEWAY_DB,
        projectId,
        outcome: job.status === 'failed' ? 'error' : 'ok',
        provider: chosen.provider,
        model: chosen.model,
      }),
    );

    // Persist job mapping to KV so polling can recover project_id context (best-effort).
    try {
      await c.env.HEALTH_KV.put(
        `video_job:${job.id}`,
        JSON.stringify({ provider: chosen.provider, model: chosen.model, project_id: projectId }),
        { expirationTtl: 60 * 60 * 24 },
      );
    } catch {
      // Ignore KV failures
    }

    return c.json(
      {
        id: job.id,
        status: job.status,
        video_url: job.video_url,
        poll_url: `/v1/videos/generations/${job.id}`,
        error: job.error,
        x_gateway: {
          provider: chosen.provider,
          model: chosen.model,
          attempts: 1,
          reasoning_effort: 'auto' as const,
          request_id: requestId,
          project_id: projectId,
        },
      } as never,
      statusCode as 200 | 202,
    );
  } catch (err) {
    c.executionCtx.waitUntil(
      recordAnalytics({ db: c.env.GATEWAY_DB, projectId, outcome: 'error', provider: chosen.provider, model: chosen.model }),
    );
    return c.json(
      { error: { message: `Video submit failed: ${getErrorMessage(err)}`, type: 'provider_error' } },
      502,
    );
  }
});

// ── /v1/videos/generations/{id} (poll) ──────────────────────────────
const videosPollRoute = createRoute({
  method: 'get',
  path: '/v1/videos/generations/{id}',
  request: { params: z.object({ id: z.string().min(1).max(256) }) },
  responses: {
    200: { description: 'Video job status', content: { 'application/json': { schema: videoGenResponseSchema } } },
    404: { description: 'Job not found', content: { 'application/json': { schema: errorSchema } } },
    502: { description: 'Provider failure', content: { 'application/json': { schema: errorSchema } } },
    503: { description: 'Provider not configured', content: { 'application/json': { schema: errorSchema } } },
  },
});

app.openapi(videosPollRoute, async (c) => {
  const { id } = c.req.valid('param');

  let provider: VideoProvider = 'together';
  let model = '';
  let projectId: string | undefined;

  try {
    const meta = await c.env.HEALTH_KV.get(`video_job:${id}`, 'json') as
      | { provider?: VideoProvider; model?: string; project_id?: string }
      | null;
    if (meta?.provider) provider = meta.provider;
    if (meta?.model) model = meta.model;
    if (meta?.project_id) projectId = meta.project_id;
  } catch {
    // Ignore KV lookup failure — fall back to default (together).
  }

  if (!hasVideoProviderKey(c.env, provider)) {
    return c.json(
      { error: { message: 'Video provider not configured', type: 'configuration_error', code: 'no_video_provider' } },
      503,
    );
  }

  try {
    const poller = videoProviderCallers.together.poll;
    const job = await poller(c.env, id);
    return c.json(
      {
        id: job.id,
        status: job.status,
        video_url: job.video_url,
        error: job.error,
        x_gateway: {
          provider,
          model,
          attempts: 1,
          reasoning_effort: 'auto' as const,
          request_id: createRequestId(),
          project_id: projectId,
        },
      } as never,
      200,
    );
  } catch (err) {
    return c.json(
      { error: { message: `Video poll failed: ${getErrorMessage(err)}`, type: 'provider_error' } },
      502,
    );
  }
});

// ── /v1/audio/speech (TTS standalone) ───────────────────────────────
const audioSpeechRoute = createRoute({
  method: 'post',
  path: '/v1/audio/speech',
  request: {
    body: { content: { 'application/json': { schema: ttsRequestSchema } } },
  },
  responses: {
    200: {
      description: 'Synthesized audio bytes',
      content: {
        'audio/mpeg': { schema: z.unknown() },
        'audio/wav': { schema: z.unknown() },
        'audio/opus': { schema: z.unknown() },
      },
    },
    400: { description: 'Invalid input', content: { 'application/json': { schema: errorSchema } } },
    502: { description: 'Provider failure', content: { 'application/json': { schema: errorSchema } } },
    503: { description: 'No TTS provider', content: { 'application/json': { schema: errorSchema } } },
  },
});

app.openapi(audioSpeechRoute, async (c) => {
  const body = c.req.valid('json');
  const headerProjectId = c.req.header('x-gateway-project-id') ?? undefined;
  const projectId = resolveProjectId(headerProjectId, body.project_id);
  if (!projectId) {
    return c.json(
      { error: { message: 'Missing or invalid project_id. Use 1-64 chars [a-zA-Z0-9._:-]', type: 'invalid_request_error', code: 'invalid_project_id' } },
      400,
    );
  }

  const forcedProvider = c.req.header('x-gateway-force-provider') ?? undefined;
  const requestedModel = body.model.trim();
  const requestedLower = requestedModel.toLowerCase();

  const registry = getTtsRegistry(c.env).filter((cand) => {
    if (forcedProvider && cand.provider !== forcedProvider) return false;
    if (requestedModel && requestedLower !== 'auto' && cand.model !== requestedModel && cand.id !== requestedModel) return false;
    if (!hasTtsProviderKey(c.env, cand.provider)) return false;
    return true;
  });

  if (registry.length === 0) {
    return c.json(
      {
        error: {
          message: 'TTS unavailable: no GROQ_API_KEY and Workers AI binding missing',
          type: 'configuration_error',
          code: 'no_tts_provider',
        },
      },
      503,
    );
  }

  const sorted = [...registry].sort((a, b) => b.priority - a.priority);
  let lastError = 'Unknown error';
  let chosenProvider: string | undefined;
  let chosenModel: string | undefined;

  for (const cand of sorted) {
    chosenProvider = cand.provider;
    chosenModel = cand.model;

    try {
      const caller = ttsProviderCallers[cand.provider];
      const result = await caller({
        env: c.env,
        model: cand.model,
        input: body.input,
        voice: body.voice,
        response_format: body.response_format,
        speed: body.speed,
      });

      c.executionCtx.waitUntil(
        recordAnalytics({ db: c.env.GATEWAY_DB, projectId, outcome: 'ok', provider: cand.provider, model: cand.model }),
      );

      return new Response(result.audio, {
        headers: {
          'content-type': result.contentType,
          'x-gateway-provider': cand.provider,
          'x-gateway-model': cand.model,
          'x-gateway-project-id': projectId,
        },
      });
    } catch (err) {
      lastError = getErrorMessage(err);
      continue;
    }
  }

  c.executionCtx.waitUntil(
    recordAnalytics({ db: c.env.GATEWAY_DB, projectId, outcome: 'error', provider: chosenProvider as Provider | undefined, model: chosenModel }),
  );
  return c.json(
    { error: { message: `All TTS providers failed: ${lastError}`, type: 'provider_error' } },
    502,
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

const DASHBOARD_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Free AI Gateway — Live</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
  :root {
    --bg: #0a0a0b;
    --surface: #111114;
    --surface-2: #17171c;
    --border: #22222a;
    --text: #e7e7ea;
    --muted: #8a8a94;
    --accent: #7c5cff;
    --success: #22c55e;
    --danger: #ef4444;
    --warn: #f59e0b;
    --radius: 10px;
    --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
    font-size: 14px; line-height: 1.4; -webkit-font-smoothing: antialiased; }
  a { color: var(--accent); text-decoration: none; }
  .app { max-width: 1400px; margin: 0 auto; padding: 20px 24px 60px; }
  .topbar { display: flex; flex-wrap: wrap; align-items: center; gap: 12px;
    padding: 14px 16px; background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); margin-bottom: 20px; }
  .topbar h1 { font-size: 15px; margin: 0; font-weight: 600; letter-spacing: -0.01em; }
  .topbar h1 .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%;
    background: var(--success); margin-right: 8px; box-shadow: 0 0 8px var(--success);
    animation: pulse 2s infinite; vertical-align: middle; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
  .topbar .spacer { flex: 1; }
  .topbar input, .topbar select, .topbar button {
    background: var(--surface-2); color: var(--text); border: 1px solid var(--border);
    border-radius: 6px; padding: 7px 10px; font-size: 13px; font-family: inherit;
    outline: none; transition: border-color .15s;
  }
  .topbar input { width: 220px; font-family: var(--mono); }
  .topbar input:focus, .topbar select:focus { border-color: var(--accent); }
  .topbar button { cursor: pointer; }
  .topbar button:hover { border-color: var(--accent); }
  .topbar label { display: inline-flex; align-items: center; gap: 6px; color: var(--muted); font-size: 13px; cursor: pointer; }
  .topbar label input[type=checkbox] { width: auto; accent-color: var(--accent); }
  .last-updated { color: var(--muted); font-size: 12px; font-family: var(--mono); }

  .banner { padding: 10px 14px; border-radius: var(--radius); margin-bottom: 16px;
    background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.4);
    color: #fca5a5; font-size: 13px; display: none; }
  .banner.show { display: block; }

  .empty-state { padding: 60px 20px; text-align: center; color: var(--muted);
    background: var(--surface); border: 1px dashed var(--border); border-radius: var(--radius); }
  .empty-state code { background: var(--surface-2); padding: 2px 6px; border-radius: 4px;
    font-family: var(--mono); color: var(--text); }

  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
  .kpi { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; }
  .kpi .label { color: var(--muted); font-size: 12px; text-transform: uppercase;
    letter-spacing: 0.05em; margin-bottom: 8px; }
  .kpi .value { font-size: 26px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .kpi .sub { color: var(--muted); font-size: 12px; margin-top: 4px; font-family: var(--mono); }
  .kpi.good .value { color: var(--success); }
  .kpi.bad .value { color: var(--danger); }

  .grid { display: grid; gap: 16px; }
  .grid-2 { grid-template-columns: 2fr 1fr; }
  @media (max-width: 960px) {
    .grid-2 { grid-template-columns: 1fr; }
    .kpis { grid-template-columns: repeat(2, 1fr); }
    .topbar input { width: 100%; }
  }

  .card { background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 16px; margin-bottom: 16px; }
  .card h2 { margin: 0 0 12px; font-size: 13px; font-weight: 600; color: var(--muted);
    text-transform: uppercase; letter-spacing: 0.05em; }
  .chart-wrap { position: relative; height: 280px; }
  .chart-wrap.tall { height: 320px; }

  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; color: var(--muted); font-weight: 500; font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.05em; padding: 8px 10px;
    border-bottom: 1px solid var(--border); }
  td { padding: 10px; border-bottom: 1px solid var(--border); font-variant-numeric: tabular-nums; }
  tbody tr:last-child td { border-bottom: none; }
  tbody tr:hover { background: rgba(255,255,255,0.02); }
  .mono { font-family: var(--mono); font-size: 12px; }

  .badge { display: inline-block; padding: 2px 8px; border-radius: 10px;
    font-size: 11px; font-family: var(--mono); font-weight: 500; }
  .badge.ok { background: rgba(34,197,94,0.15); color: var(--success); }
  .badge.warn { background: rgba(245,158,11,0.15); color: var(--warn); }
  .badge.err { background: rgba(239,68,68,0.15); color: var(--danger); }
  .badge.mute { background: var(--surface-2); color: var(--muted); }

  .progress { position: relative; height: 6px; background: var(--surface-2);
    border-radius: 3px; overflow: hidden; min-width: 80px; }
  .progress > div { height: 100%; background: var(--accent); border-radius: 3px; transition: width .3s; }
  .progress.warn > div { background: var(--warn); }
  .progress.danger > div { background: var(--danger); }
  .progress-label { font-size: 11px; color: var(--muted); margin-top: 4px; font-family: var(--mono); }

  .section-title { font-size: 12px; color: var(--muted); text-transform: uppercase;
    letter-spacing: 0.05em; margin: 20px 0 10px; }

  .throttle-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 12px; }
  .tcard { background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 14px; display: flex; flex-direction: column; gap: 8px; }
  .tcard .head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .tcard .name { font-weight: 600; font-size: 13px; letter-spacing: -0.01em; }
  .tcard .attempts { font-size: 22px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .tcard .attempts small { font-size: 11px; color: var(--muted); font-weight: 400; margin-left: 4px; }
  .tcard .row { display: flex; justify-content: space-between; font-size: 12px; color: var(--muted);
    font-family: var(--mono); }
  .tcard .row b { color: var(--text); font-weight: 500; }
  .tcard .cool { align-self: flex-start; }
  .stackbar { display: flex; height: 6px; width: 100%; background: var(--surface-2);
    border-radius: 3px; overflow: hidden; }
  .stackbar > span { height: 100%; display: block; }
  .stacklegend { display: flex; flex-wrap: wrap; gap: 8px; font-size: 10px; color: var(--muted);
    font-family: var(--mono); }
  .stacklegend i { display: inline-block; width: 8px; height: 8px; border-radius: 2px;
    margin-right: 4px; vertical-align: middle; }
  .pill-ok { background: rgba(34,197,94,0.15); color: var(--success); }
  .pill-warn { background: rgba(245,158,11,0.15); color: var(--warn); }
  .pill-err { background: rgba(239,68,68,0.15); color: var(--danger); }
</style>
</head>
<body>
<div class="app">
  <div class="topbar">
    <h1><span class="dot"></span>Free AI Gateway — Live</h1>
    <div class="spacer"></div>
    <input id="apiKey" type="password" placeholder="Bearer token (if required)" autocomplete="off" />
    <select id="rangeSel">
      <option value="1">1d</option>
      <option value="7" selected>7d</option>
      <option value="30">30d</option>
      <option value="90">90d</option>
    </select>
    <label><input type="checkbox" id="autoRefresh" checked /> Auto</label>
    <button id="refreshBtn" title="Refresh now">Refresh</button>
    <span class="last-updated" id="lastUpdated">—</span>
  </div>

  <div class="banner" id="errBanner"></div>

  <div id="emptyState" class="empty-state" style="display:none">
    <div style="font-size:15px;color:var(--text);margin-bottom:6px;">No traffic yet</div>
    Hit <code>/v1/chat/completions</code> with an <code>x-project-id</code> header to start seeing data.
  </div>

  <div id="mainView">
    <div class="kpis">
      <div class="kpi"><div class="label">Total requests</div><div class="value" id="kpiTotal">0</div><div class="sub" id="kpiTotalSub">—</div></div>
      <div class="kpi good"><div class="label">Success rate</div><div class="value" id="kpiSuccess">0%</div><div class="sub" id="kpiSuccessSub">—</div></div>
      <div class="kpi bad"><div class="label">Failed</div><div class="value" id="kpiFailed">0</div><div class="sub" id="kpiFailedSub">—</div></div>
      <div class="kpi"><div class="label">Active models</div><div class="value" id="kpiActive">0</div><div class="sub" id="kpiActiveSub">—</div></div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <h2>Timeline — Successful vs Failed (per day)</h2>
        <div class="chart-wrap"><canvas id="chartTimeline"></canvas></div>
      </div>
      <div class="card">
        <h2>Provider breakdown</h2>
        <div class="chart-wrap"><canvas id="chartProviders"></canvas></div>
        <div id="providerBadges" style="margin-top:12px;display:flex;flex-wrap:wrap;gap:6px;"></div>
      </div>
    </div>

    <div class="card" id="throttleCard" style="display:none">
      <h2>Provider throttle health</h2>
      <div class="throttle-grid" id="throttleGrid"></div>
      <div class="stacklegend" style="margin-top:10px">
        <span><i style="background:#ef4444"></i>usage_retriable</span>
        <span><i style="background:#f59e0b"></i>input_nonretriable</span>
        <span><i style="background:#a855f7"></i>safety_refusal</span>
        <span><i style="background:#6b7280"></i>provider_fatal</span>
        <span><i style="background:#22c55e"></i>success</span>
      </div>
    </div>

    <div class="card">
      <h2>Live model health</h2>
      <table>
        <thead><tr>
          <th>Key</th><th>Attempts</th><th>Success</th><th>Avg latency</th>
          <th>Daily usage</th><th>Status</th>
        </tr></thead>
        <tbody id="healthBody"></tbody>
      </table>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <h2>Top 10 models</h2>
        <table>
          <thead><tr>
            <th>Model</th><th>Requests</th><th>Success</th><th>Failed</th>
          </tr></thead>
          <tbody id="topModelsBody"></tbody>
        </table>
      </div>
      <div class="card">
        <h2>Projects</h2>
        <table>
          <thead><tr>
            <th>Project</th><th>Requests</th><th>Success</th>
          </tr></thead>
          <tbody id="projectsBody"></tbody>
        </table>
      </div>
    </div>
  </div>
</div>

<script type="module">
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => (n ?? 0).toLocaleString();
  const pct = (n) => (isFinite(n) ? (n * 100).toFixed(1) + '%' : '—');
  const ms = (n) => (n > 0 ? Math.round(n) + ' ms' : '—');

  const state = {
    apiKey: localStorage.getItem('freeai.apiKey') || '',
    days: Number(localStorage.getItem('freeai.days') || 7),
    autoRefresh: localStorage.getItem('freeai.autoRefresh') !== 'false',
    charts: { timeline: null, providers: null },
    inFlight: null,
    timer: null,
  };

  $('apiKey').value = state.apiKey;
  $('rangeSel').value = String(state.days);
  $('autoRefresh').checked = state.autoRefresh;

  $('apiKey').addEventListener('change', (e) => {
    state.apiKey = e.target.value.trim();
    localStorage.setItem('freeai.apiKey', state.apiKey);
    refresh();
  });
  $('rangeSel').addEventListener('change', (e) => {
    state.days = Number(e.target.value);
    localStorage.setItem('freeai.days', String(state.days));
    refresh();
  });
  $('autoRefresh').addEventListener('change', (e) => {
    state.autoRefresh = e.target.checked;
    localStorage.setItem('freeai.autoRefresh', String(state.autoRefresh));
    schedule();
  });
  $('refreshBtn').addEventListener('click', () => refresh());

  document.addEventListener('visibilitychange', schedule);
  window.addEventListener('focus', () => { if (state.autoRefresh) refresh(); });

  function showError(msg) {
    const b = $('errBanner');
    if (!msg) { b.classList.remove('show'); b.textContent = ''; return; }
    b.textContent = msg;
    b.classList.add('show');
  }

  function authHeaders() {
    return state.apiKey ? { Authorization: 'Bearer ' + state.apiKey } : {};
  }

  async function fetchBoth(signal) {
    const headers = authHeaders();
    const [a, h, p] = await Promise.all([
      fetch('/v1/analytics?days=' + state.days, { headers, signal }),
      fetch('/health', { headers, signal }),
      fetch('/v1/stats/providers', { signal }).catch(() => null),
    ]);
    if (!a.ok) throw new Error('Analytics ' + a.status + ': ' + (await a.text()).slice(0, 200));
    if (!h.ok) throw new Error('Health ' + h.status + ': ' + (await h.text()).slice(0, 200));
    let providerStats = null;
    if (p && p.ok) { try { providerStats = await p.json(); } catch { providerStats = null; } }
    return { analytics: await a.json(), health: await h.json(), providerStats };
  }

  async function refresh() {
    if (state.inFlight) state.inFlight.abort();
    const ctrl = new AbortController();
    state.inFlight = ctrl;
    try {
      const { analytics, health, providerStats } = await fetchBoth(ctrl.signal);
      state.inFlight = null;
      render(analytics, health, providerStats);
      showError('');
      $('lastUpdated').textContent = 'Updated ' + new Date().toLocaleTimeString();
    } catch (err) {
      if (err.name === 'AbortError') return;
      state.inFlight = null;
      showError('Fetch failed — ' + err.message);
    }
  }

  function schedule() {
    if (state.timer) { clearInterval(state.timer); state.timer = null; }
    if (state.autoRefresh && document.visibilityState === 'visible') {
      state.timer = setInterval(refresh, 5000);
    }
  }

  function render(analytics, health, providerStats) {
    const total = analytics.total_requests || 0;
    const healthItems = health.items || health.models || [];
    const activeModels = healthItems.filter((h) => (h.attempts || 0) > 0).length;

    if (total === 0 && activeModels === 0) {
      $('emptyState').style.display = 'block';
      $('mainView').style.display = 'none';
      return;
    }
    $('emptyState').style.display = 'none';
    $('mainView').style.display = '';

    // KPIs
    $('kpiTotal').textContent = fmt(total);
    $('kpiTotalSub').textContent = 'last ' + state.days + 'd';
    $('kpiSuccess').textContent = pct(analytics.success_rate || 0);
    $('kpiSuccessSub').textContent = fmt(analytics.successful_requests) + ' ok';
    $('kpiFailed').textContent = fmt(analytics.failed_requests);
    $('kpiFailedSub').textContent = total > 0 ? pct((analytics.failed_requests || 0) / total) + ' of total' : '—';
    $('kpiActive').textContent = activeModels;
    $('kpiActiveSub').textContent = healthItems.length + ' registered';

    renderTimeline(analytics.daily || []);
    renderProviders(analytics.providers || {});
    renderThrottles(providerStats && providerStats.stats ? providerStats.stats : []);
    renderHealth(healthItems);
    renderTopModels(analytics.models || {});
    renderProjects(analytics.projects || {});
  }

  const chartColors = {
    grid: '#22222a',
    tick: '#8a8a94',
    success: '#22c55e',
    danger: '#ef4444',
    accent: '#7c5cff',
  };
  const baseOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: chartColors.tick, font: { size: 11 } } } },
    scales: {
      x: { ticks: { color: chartColors.tick }, grid: { color: chartColors.grid, drawBorder: false } },
      y: { ticks: { color: chartColors.tick }, grid: { color: chartColors.grid, drawBorder: false }, beginAtZero: true },
    },
  };

  function renderTimeline(daily) {
    const labels = daily.map((d) => d.date);
    const succ = daily.map((d) => d.successful || 0);
    const fail = daily.map((d) => d.failed || 0);
    const data = {
      labels,
      datasets: [
        { label: 'Successful', data: succ, backgroundColor: chartColors.success, stack: 's' },
        { label: 'Failed', data: fail, backgroundColor: chartColors.danger, stack: 's' },
      ],
    };
    const opts = { ...baseOpts, scales: { x: { ...baseOpts.scales.x, stacked: true }, y: { ...baseOpts.scales.y, stacked: true } } };
    if (state.charts.timeline) {
      state.charts.timeline.data = data;
      state.charts.timeline.options = opts;
      state.charts.timeline.update('none');
    } else {
      state.charts.timeline = new Chart($('chartTimeline'), { type: 'bar', data, options: opts });
    }
  }

  function renderProviders(providers) {
    const entries = Object.entries(providers).sort((a, b) => (b[1].requests || 0) - (a[1].requests || 0));
    const labels = entries.map((e) => e[0]);
    const values = entries.map((e) => e[1].requests || 0);
    const data = { labels, datasets: [{ label: 'Requests', data: values, backgroundColor: chartColors.accent, borderRadius: 4 }] };
    const opts = { ...baseOpts, indexAxis: 'y', plugins: { legend: { display: false } } };
    if (state.charts.providers) {
      state.charts.providers.data = data;
      state.charts.providers.options = opts;
      state.charts.providers.update('none');
    } else {
      state.charts.providers = new Chart($('chartProviders'), { type: 'bar', data, options: opts });
    }
    const bad = $('providerBadges');
    bad.innerHTML = '';
    entries.forEach(([name, p]) => {
      const rate = p.requests > 0 ? (p.successful || 0) / p.requests : 0;
      const cls = rate >= 0.95 ? 'ok' : rate >= 0.8 ? 'warn' : 'err';
      const el = document.createElement('span');
      el.className = 'badge ' + cls;
      el.textContent = name + ' · ' + pct(rate);
      bad.appendChild(el);
    });
  }

  function renderHealth(items) {
    const tb = $('healthBody');
    tb.innerHTML = '';
    const now = Date.now();
    const sorted = [...items].sort((a, b) => (b.attempts || 0) - (a.attempts || 0));
    if (sorted.length === 0) {
      tb.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:20px">No models registered</td></tr>';
      return;
    }
    for (const m of sorted) {
      const rate = m.success_rate ?? 0;
      const rateCls = m.attempts > 0 ? (rate >= 0.95 ? 'ok' : rate >= 0.8 ? 'warn' : 'err') : 'mute';
      const used = m.daily_used || 0;
      const limit = m.daily_limit || 0;
      const usageRatio = limit > 0 ? used / limit : 0;
      const barCls = usageRatio >= 0.9 ? 'danger' : usageRatio >= 0.7 ? 'warn' : '';
      const cooldown = (m.cooldown_until || 0) > now;
      const cooldownSec = cooldown ? Math.ceil((m.cooldown_until - now) / 1000) : 0;
      const statusBadge = cooldown
        ? '<span class="badge err">cooldown ' + cooldownSec + 's</span>'
        : m.attempts > 0 ? '<span class="badge ok">live</span>' : '<span class="badge mute">idle</span>';
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td class="mono">' + escape(m.key) + '</td>' +
        '<td>' + fmt(m.attempts) + '</td>' +
        '<td><span class="badge ' + rateCls + '">' + (m.attempts > 0 ? pct(rate) : '—') + '</span></td>' +
        '<td>' + ms(m.avg_latency_ms) + '</td>' +
        '<td><div class="progress ' + barCls + '"><div style="width:' + Math.min(100, usageRatio * 100).toFixed(1) + '%"></div></div>' +
          '<div class="progress-label">' + fmt(used) + (limit > 0 ? ' / ' + fmt(limit) : '') + '</div></td>' +
        '<td>' + statusBadge + '</td>';
      tb.appendChild(tr);
    }
  }

  function renderTopModels(models) {
    const tb = $('topModelsBody');
    tb.innerHTML = '';
    const entries = Object.entries(models)
      .map(([k, v]) => ({ key: k, ...v }))
      .sort((a, b) => (b.requests || 0) - (a.requests || 0))
      .slice(0, 10);
    if (entries.length === 0) {
      tb.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:20px">—</td></tr>';
      return;
    }
    for (const m of entries) {
      const rate = m.requests > 0 ? (m.successful || 0) / m.requests : 0;
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td class="mono">' + escape(m.key) + '</td>' +
        '<td>' + fmt(m.requests) + '</td>' +
        '<td>' + pct(rate) + '</td>' +
        '<td>' + fmt(m.failed) + '</td>';
      tb.appendChild(tr);
    }
  }

  function renderProjects(projects) {
    const tb = $('projectsBody');
    tb.innerHTML = '';
    const entries = Object.entries(projects)
      .map(([k, v]) => ({ id: k, ...v }))
      .sort((a, b) => (b.requests || 0) - (a.requests || 0));
    if (entries.length === 0) {
      tb.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--muted);padding:20px">No projects yet</td></tr>';
      return;
    }
    for (const p of entries) {
      const rate = p.requests > 0 ? (p.successful || 0) / p.requests : 0;
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td class="mono">' + escape(p.id) + '</td>' +
        '<td>' + fmt(p.requests) + '</td>' +
        '<td>' + pct(rate) + '</td>';
      tb.appendChild(tr);
    }
  }

  function renderThrottles(stats) {
    const card = $('throttleCard');
    const grid = $('throttleGrid');
    const active = (stats || []).filter((s) => (s.total_attempts || 0) > 0);
    if (active.length === 0) { card.style.display = 'none'; grid.innerHTML = ''; return; }
    card.style.display = '';
    active.sort((a, b) => (b.throttle_rate || 0) - (a.throttle_rate || 0));
    const colors = { usage_retriable: '#ef4444', input_nonretriable: '#f59e0b',
      safety_refusal: '#a855f7', provider_fatal: '#6b7280', success: '#22c55e' };
    grid.innerHTML = '';
    for (const s of active) {
      const rate = s.throttle_rate || 0;
      const pillCls = rate > 0.2 ? 'pill-err' : rate >= 0.05 ? 'pill-warn' : 'pill-ok';
      const fb = s.failure_breakdown || {};
      const total = s.total_attempts || 0;
      const sumFail = (fb.usage_retriable || 0) + (fb.input_nonretriable || 0)
        + (fb.safety_refusal || 0) + (fb.provider_fatal || 0);
      const succCount = Math.max(0, total - sumFail);
      const seg = (n, c) => n > 0 ? '<span style="width:' + (n / total * 100).toFixed(2)
        + '%;background:' + c + '"></span>' : '';
      const bar = seg(fb.usage_retriable || 0, colors.usage_retriable)
        + seg(fb.input_nonretriable || 0, colors.input_nonretriable)
        + seg(fb.safety_refusal || 0, colors.safety_refusal)
        + seg(fb.provider_fatal || 0, colors.provider_fatal)
        + seg(succCount, colors.success);
      const firstThr = s.avg_attempts_before_first_throttle;
      const spacing = s.throttle_spacing_p50;
      const cooling = s.models_in_cooldown || 0;
      const card2 = document.createElement('div');
      card2.className = 'tcard';
      card2.innerHTML =
        '<div class="head">'
        + '<span class="name mono">' + escape(s.provider) + '</span>'
        + '<span class="badge ' + pillCls + '" title="requests that returned 429">'
        + (rate * 100).toFixed(1) + '%</span>'
        + '</div>'
        + '<div class="attempts">' + fmt(total) + '<small>attempts</small></div>'
        + '<div class="stackbar">' + bar + '</div>'
        + '<div class="row"><span>~ before first 429</span><b>'
        + (firstThr == null ? '—' : '~' + Number(firstThr).toFixed(1)) + '</b></div>'
        + '<div class="row"><span>between throttles (p50)</span><b>'
        + (spacing == null ? '—' : 'every ~' + spacing) + '</b></div>'
        + (cooling > 0 ? '<span class="badge err cool">' + cooling + ' cooling down</span>' : '');
      grid.appendChild(card2);
    }
  }

  function escape(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  refresh();
  schedule();
</script>
</body>
</html>`;

const setDashboardHeaders = (c: { header: (k: string, v: string) => void }) => {
  c.header('cache-control', 'no-store, no-cache, must-revalidate, max-age=0');
  c.header('cdn-cache-control', 'no-store');
  c.header('cloudflare-cdn-cache-control', 'no-store');
};
app.get('/dashboard', (c) => { setDashboardHeaders(c); return c.html(DASHBOARD_HTML); });
app.get('/dashboard/', (c) => c.redirect('/dashboard'));
app.get('/live', (c) => { setDashboardHeaders(c); return c.html(DASHBOARD_HTML); });
app.get('/v1/dashboard', (c) => { setDashboardHeaders(c); return c.html(DASHBOARD_HTML); });

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

const analyticsRoute = createRoute({
  method: 'get',
  path: '/v1/analytics',
  request: {
    query: z.object({
      project_id: z.string().optional(),
      days: z.coerce.number().int().min(1).max(365).optional(),
    }),
  },
  responses: {
    200: {
      description: 'Usage analytics',
      content: { 'application/json': { schema: analyticsResponseSchema } },
    },
    400: { description: 'Bad Request' },
    401: { description: 'Unauthorized' },
  },
});

app.openapi(analyticsRoute, async (c) => {
  // Analytics is publicly readable. Only data-generating endpoints require GATEWAY_API_KEY.
  const query = c.req.valid('query');
  const projectId = query.project_id;
  const days = query.days;

  const filters: string[] = [];
  const params: unknown[] = [];
  if (projectId) {
    filters.push('project_id = ?');
    params.push(projectId);
  }
  if (days) {
    filters.push(`date >= date('now', ?)`);
    params.push(`-${days} days`);
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const stats = await c.env.GATEWAY_DB.prepare(
    `SELECT SUM(total_requests) as total, SUM(successful_requests) as successful, SUM(failed_requests) as failed FROM project_analytics ${where}`
  ).bind(...params).first<{ total: number | null; successful: number | null; failed: number | null }>();

  const providerStats = await c.env.GATEWAY_DB.prepare(
    `SELECT provider, SUM(total_requests) as requests, SUM(successful_requests) as successful, SUM(failed_requests) as failed FROM project_analytics ${where} GROUP BY provider`
  ).bind(...params).all<{ provider: string; requests: number; successful: number; failed: number }>();

  const modelStats = await c.env.GATEWAY_DB.prepare(
    `SELECT model, SUM(total_requests) as requests, SUM(successful_requests) as successful, SUM(failed_requests) as failed FROM project_analytics ${where} GROUP BY model`
  ).bind(...params).all<{ model: string; requests: number; successful: number; failed: number }>();

  const projectStats = await c.env.GATEWAY_DB.prepare(
    `SELECT project_id, SUM(total_requests) as requests, SUM(successful_requests) as successful, SUM(failed_requests) as failed FROM project_analytics ${where} GROUP BY project_id`
  ).bind(...params).all<{ project_id: string; requests: number; successful: number; failed: number }>();

  const dailyStats = await c.env.GATEWAY_DB.prepare(
    `SELECT date, SUM(total_requests) as requests, SUM(successful_requests) as successful, SUM(failed_requests) as failed FROM project_analytics ${where} GROUP BY date ORDER BY date ASC`
  ).bind(...params).all<{ date: string; requests: number; successful: number; failed: number }>();

  const providers: Record<string, unknown> = {};
  providerStats.results.forEach((p) => {
    providers[p.provider] = { requests: p.requests, successful: p.successful, failed: p.failed };
  });
  const models: Record<string, unknown> = {};
  modelStats.results.forEach((m) => {
    models[m.model] = { requests: m.requests, successful: m.successful, failed: m.failed };
  });
  const projects: Record<string, unknown> = {};
  projectStats.results.forEach((p) => {
    projects[p.project_id] = { requests: p.requests, successful: p.successful, failed: p.failed };
  });

  const total = stats?.total ?? 0;
  return c.json({
    total_requests: total,
    successful_requests: stats?.successful ?? 0,
    failed_requests: stats?.failed ?? 0,
    success_rate: total > 0 ? (stats?.successful ?? 0) / total : 0,
    providers,
    models,
    projects,
    daily: dailyStats.results,
  });
});

app.get('/v1/stats/providers', async (c) => {
  const stats = await providerStats(c.env);
  return c.json({ stats });
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



// Fallback to static assets (docs site) for any path worker doesn't handle
app.notFound((c) => {
  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return c.json({ error: { message: 'Not found', type: 'not_found' } }, 404);
});

export default app;
export { HealthStateDO, IpRateLimitDO };
