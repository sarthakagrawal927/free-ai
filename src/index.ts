import { swaggerUI } from '@hono/swagger-ui';
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { bearerAuth } from 'hono/bearer-auth';
import pLimit from 'p-limit';
import pRetry from 'p-retry';
import { AbortError } from 'p-retry';
import { getModelKey, getModelRegistry, getProviderLimits, getRateLimitConfig, isPlaygroundEnabled } from './config';
import { providerCallers, providerEmbeddingCallers } from './providers';
import { classifyError, isRetriableFailure } from './router/classify-error';
import { selectCandidates } from './router/select-model';
import { renderLandingHtml } from './landing';
import { renderPlaygroundHtml } from './playground';
import { healthLookup, healthRecord, healthSnapshot, consumeIpRateLimit } from './state/client';
import { HealthStateDO } from './state/health-do';
import { IpRateLimitDO } from './state/ip-rate-limit-do';
import { createSseStream, toSseData } from './utils/sse';
import { buildCompletionEnvelope, createRequestId, getErrorMessage, normalizeMessages } from './utils/request';
import type { Env, GatewayMeta, NormalizedChatRequest, Provider, ProviderLimitConfig } from './types';

const app = new OpenAPIHono<{ Bindings: Env }>();

const messageSchema = z
  .object({
    role: z.enum(['system', 'user', 'assistant', 'tool']),
    content: z.string().min(1),
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
    model: z.string().default('auto'),
    input: z.union([z.string(), z.array(z.string().min(1)).min(1)]),
    encoding_format: z.enum(['float']).optional(),
    dimensions: z.number().int().min(1).max(4096).optional(),
    project_id: projectIdSchema.optional(),
  })
  .openapi('EmbeddingsRequest');

const gatewayMetaSchema = z
  .object({
    provider: z.enum(['workers_ai', 'groq', 'gemini', 'openrouter', 'cerebras', 'cli_bridge']),
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

const analyticsQuerySchema = z.object({
  project_id: projectIdSchema.optional(),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const analyticsDaySchema = z.object({
  usage_date: z.string(),
  total_requests: z.number(),
  ok_requests: z.number(),
  error_requests: z.number(),
  total_attempts: z.number(),
});

const analyticsProviderSchema = z.object({
  provider: z.string(),
  total_requests: z.number(),
  ok_requests: z.number(),
  error_requests: z.number(),
  avg_latency_ms: z.number(),
});

const analyticsReasoningSchema = z.object({
  reasoning_effort: z.string(),
  total_requests: z.number(),
});

const analyticsEndpointSchema = z.object({
  endpoint: z.string(),
  total_requests: z.number(),
  ok_requests: z.number(),
  error_requests: z.number(),
});

const analyticsProjectSchema = z.object({
  project_id: z.string(),
  total_requests: z.number(),
  ok_requests: z.number(),
  error_requests: z.number(),
});

const analyticsResponseSchema = z.object({
  ok: z.literal(true),
  range: z.object({
    date_from: z.string(),
    date_to: z.string(),
    days: z.number(),
    project_id: z.string().nullable(),
  }),
  totals: z.object({
    total_requests: z.number(),
    ok_requests: z.number(),
    error_requests: z.number(),
    success_rate: z.number(),
    avg_attempts: z.number(),
    avg_latency_ms: z.number(),
  }),
  by_day: z.array(analyticsDaySchema),
  by_provider: z.array(analyticsProviderSchema),
  by_reasoning_effort: z.array(analyticsReasoningSchema),
  by_endpoint: z.array(analyticsEndpointSchema),
  by_project: z.array(analyticsProjectSchema),
});

const keyRequestBodySchema = z
  .object({
    name: z.string().min(2).max(80),
    email: z.string().email(),
    company: z.string().max(120).optional(),
    use_case: z.string().min(10).max(2000),
    intended_use: z.enum(['personal', 'internal', 'production']).default('internal'),
    expected_daily_requests: z.number().int().min(1).max(200000).optional(),
  })
  .openapi('KeyRequestBody');

const keyRequestQueuedResponseSchema = z
  .object({
    ok: z.literal(true),
    request_id: z.string(),
    status: z.literal('queued'),
    message: z.string(),
  })
  .openapi('KeyRequestQueuedResponse');

const keyRequestApprovedResponseSchema = z
  .object({
    ok: z.literal(true),
    request_id: z.string(),
    status: z.literal('approved'),
    api_key: z.string(),
    message: z.string(),
  })
  .openapi('KeyRequestApprovedResponse');

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

function isoNow(): string {
  return new Date().toISOString();
}

const MAX_ANALYTICS_DAYS = 90;

interface EmbeddingCandidate {
  provider: Provider;
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

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function defaultAnalyticsRange(): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const dateTo = toIsoDate(now);
  const start = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
  const dateFrom = toIsoDate(start);
  return { dateFrom, dateTo };
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && toIsoDate(parsed) === value;
}

function countDaysInclusive(dateFrom: string, dateTo: string): number {
  const fromMs = Date.parse(`${dateFrom}T00:00:00.000Z`);
  const toMs = Date.parse(`${dateTo}T00:00:00.000Z`);
  return Math.floor((toMs - fromMs) / (24 * 60 * 60 * 1000)) + 1;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function extractBearerToken(headerValue: string | undefined): string | undefined {
  if (!headerValue) {
    return undefined;
  }

  const [scheme, token] = headerValue.split(/\s+/, 2);
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') {
    return undefined;
  }

  return token.trim() || undefined;
}

interface TokenContext {
  valid: boolean;
  source: 'master' | 'd1' | 'kv' | 'none';
}

async function resolveGatewayTokenContext(env: Env, token: string): Promise<TokenContext> {
  if (token === env.GATEWAY_API_KEY) {
    return {
      valid: true,
      source: 'master',
    };
  }

  const hash = await sha256Hex(token);

  if (env.GATEWAY_DB) {
    try {
      const row = await env.GATEWAY_DB.prepare(
        `
        SELECT key_hash
        FROM api_keys
        WHERE key_hash = ?1
          AND status = 'active'
        LIMIT 1
        `,
      )
        .bind(hash)
        .first<{ key_hash: string }>();

      if (row?.key_hash) {
        await env.GATEWAY_DB.prepare(
          `
          UPDATE api_keys
          SET last_used_at = ?1
          WHERE key_hash = ?2
          `,
        )
          .bind(isoNow(), row.key_hash)
          .run()
          .catch(() => undefined);

        return {
          valid: true,
          source: 'd1',
        };
      }
    } catch {
      // Fall through to KV fallback.
    }
  }

  try {
    const record = await env.HEALTH_KV.get(`api-key:${hash}`);
    if (record) {
      return {
        valid: true,
        source: 'kv',
      };
    }
  } catch {
    // Ignore KV lookup errors and return invalid token.
  }

  return {
    valid: false,
    source: 'none',
  };
}

async function verifyGatewayToken(env: Env, token: string): Promise<boolean> {
  try {
    const result = await resolveGatewayTokenContext(env, token);
    return result.valid;
  } catch {
    return false;
  }
}

const authMiddleware = bearerAuth({
  verifyToken: async (token, c) => verifyGatewayToken(c.env, token),
});

app.use('/v1/*', authMiddleware);
app.use('/openapi.json', authMiddleware);
app.use('/docs', authMiddleware);

app.use('/v1/*', async (c, next) => {
  const config = getRateLimitConfig(c.env);
  const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? 'unknown';
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

function getForcedProvider(c: { req: { header: (key: string) => string | undefined } }): Provider | undefined {
  const value = c.req.header('x-gateway-force-provider');
  if (!value) {
    return undefined;
  }

  if (['workers_ai', 'groq', 'gemini', 'openrouter', 'cerebras', 'cli_bridge'].includes(value)) {
    return value as Provider;
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
    forcedProvider?: Provider;
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

async function recordGatewayRequest(
  env: Env,
  params: {
    endpoint: 'chat.completions' | 'responses' | 'embeddings';
    projectId?: string;
    requestId: string;
    reasoningEffort: NormalizedChatRequest['reasoning_effort'];
    stream: boolean;
    promptChars: number;
    messageCount: number;
    statusCode: number;
    outcome: 'ok' | 'error';
    attempts: number;
    provider?: Provider;
    model?: string;
    errorType?: string;
    latencyMs?: number;
  },
): Promise<void> {
  if (!env.GATEWAY_DB) {
    return;
  }

  const now = isoNow();
  const day = now.slice(0, 10);

  try {
    await env.GATEWAY_DB.prepare(
      `
      INSERT INTO gateway_requests (
        request_id,
        received_at,
        endpoint,
        project_id,
        reasoning_effort,
        stream,
        prompt_chars,
        message_count,
        status_code,
        outcome,
        chosen_provider,
        chosen_model,
        attempts,
        error_type,
        latency_ms
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
      `,
    )
      .bind(
        params.requestId,
        now,
        params.endpoint,
        params.projectId ?? null,
        params.reasoningEffort,
        params.stream ? 1 : 0,
        params.promptChars,
        params.messageCount,
        params.statusCode,
        params.outcome,
        params.provider ?? null,
        params.model ?? null,
        params.attempts,
        params.errorType ?? null,
        params.latencyMs ?? null,
      )
      .run();

    if (params.projectId) {
      await env.GATEWAY_DB.prepare(
        `
        INSERT INTO project_daily_usage (
          project_id,
          usage_date,
          total_requests,
          ok_requests,
          error_requests,
          total_attempts,
          updated_at
        ) VALUES (?1, ?2, 1, ?3, ?4, ?5, ?6)
        ON CONFLICT(project_id, usage_date) DO UPDATE SET
          total_requests = total_requests + 1,
          ok_requests = ok_requests + excluded.ok_requests,
          error_requests = error_requests + excluded.error_requests,
          total_attempts = total_attempts + excluded.total_attempts,
          updated_at = excluded.updated_at
        `,
      )
        .bind(
          params.projectId,
          day,
          params.outcome === 'ok' ? 1 : 0,
          params.outcome === 'error' ? 1 : 0,
          Math.max(0, params.attempts),
          now,
        )
        .run();
    }
  } catch (error) {
    console.log(
      JSON.stringify({
        event: 'gateway_request_track_error',
        request_id: params.requestId,
        project_id: params.projectId ?? null,
        message: getErrorMessage(error),
      }),
    );
  }
}

async function storeKeyRequestRecord(
  env: Env,
  params: {
    requestId: string;
    name: string;
    email: string;
    company?: string;
    useCase: string;
    intendedUse: 'personal' | 'internal' | 'production';
    expectedDailyRequests?: number;
    sourceIp?: string;
    userAgent?: string;
  },
): Promise<void> {
  const createdAt = isoNow();

  if (env.GATEWAY_DB) {
    try {
      await env.GATEWAY_DB.prepare(
        `
        INSERT INTO key_requests (
          request_id,
          name,
          email,
          company,
          use_case,
          intended_use,
          expected_daily_requests,
          status,
          requested_at,
          source_ip_hash,
          user_agent_hash
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'queued', ?8, ?9, ?10)
        `,
      )
        .bind(
          params.requestId,
          params.name,
          params.email,
          params.company ?? null,
          params.useCase,
          params.intendedUse,
          params.expectedDailyRequests ?? null,
          createdAt,
          params.sourceIp ? await sha256Hex(params.sourceIp) : null,
          params.userAgent ? await sha256Hex(params.userAgent) : null,
        )
        .run();
      return;
    } catch (error) {
      console.log(
        JSON.stringify({
          event: 'access_request_storage_error',
          request_id: params.requestId,
          message: getErrorMessage(error),
          backend: 'd1',
        }),
      );
    }
  }

  const requestRecord = {
    request_id: params.requestId,
    created_at: createdAt,
    name: params.name,
    email: params.email,
    company: params.company ?? null,
    use_case: params.useCase,
    intended_use: params.intendedUse,
    expected_daily_requests: params.expectedDailyRequests ?? null,
  };

  try {
    await env.HEALTH_KV.put(`access-request:${params.requestId}`, JSON.stringify(requestRecord), {
      expirationTtl: 60 * 60 * 24 * 45,
    });
  } catch (error) {
    console.log(
      JSON.stringify({
        event: 'access_request_storage_error',
        request_id: params.requestId,
        message: getErrorMessage(error),
        backend: 'kv',
      }),
    );
  }
}

async function storeIssuedKeyRecord(
  env: Env,
  params: {
    requestId: string;
    issuedKey: string;
    keyHash: string;
    email: string;
    intendedUse: 'personal' | 'internal' | 'production';
    expectedDailyRequests?: number;
  },
): Promise<void> {
  if (env.GATEWAY_DB) {
    try {
      await env.GATEWAY_DB.prepare(
        `
        INSERT INTO api_keys (
          key_hash,
          status,
          issued_at
        ) VALUES (?1, 'active', ?2)
        `,
      )
        .bind(
          params.keyHash,
          isoNow(),
        )
        .run();

      await env.GATEWAY_DB.prepare(
        `
        UPDATE key_requests
        SET status = 'approved',
            reviewed_at = ?1,
            reviewed_by = 'auto_issue',
            review_notes = ?2
        WHERE request_id = ?3
        `,
      )
        .bind(
          isoNow(),
          `Auto-issued key for ${params.email} (${params.intendedUse}, expected_daily_requests=${params.expectedDailyRequests ?? 0})`,
          params.requestId,
        )
        .run()
        .catch(() => undefined);

      return;
    } catch (error) {
      console.log(
        JSON.stringify({
          event: 'access_key_issue_error',
          request_id: params.requestId,
          message: getErrorMessage(error),
          backend: 'd1',
        }),
      );
    }
  }

  const keyRecord = {
    request_id: params.requestId,
    key_hash: params.keyHash,
    created_at: isoNow(),
    email: params.email,
    intended_use: params.intendedUse,
    expected_daily_requests: params.expectedDailyRequests ?? null,
    status: 'active',
  };

  await env.HEALTH_KV.put(`api-key:${params.keyHash}`, JSON.stringify(keyRecord));
}

function gatherTextFragments(input: unknown): string[] {
  if (typeof input === 'string') {
    const trimmed = input.trim();
    return trimmed ? [trimmed] : [];
  }

  if (Array.isArray(input)) {
    return input.flatMap((item) => gatherTextFragments(item));
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

  return values.flatMap((value) => gatherTextFragments(value));
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
    401: {
      description: 'Unauthorized',
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
    await recordGatewayRequest(c.env, {
      endpoint,
      projectId: undefined,
      requestId,
      reasoningEffort: body.reasoning_effort,
      stream: body.stream,
      promptChars,
      messageCount,
      statusCode: 400,
      outcome: 'error',
      attempts: 0,
      errorType: 'invalid_project_id',
      latencyMs: Date.now() - requestStartedAt,
    });

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
    await recordGatewayRequest(c.env, {
      endpoint,
      projectId,
      requestId,
      reasoningEffort: body.reasoning_effort,
      stream: body.stream,
      promptChars: 0,
      messageCount: 0,
      statusCode: 400,
      outcome: 'error',
      attempts: 0,
      errorType: 'missing_input',
      latencyMs: Date.now() - requestStartedAt,
    });

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

  const forcedProvider = getForcedProvider(c);
  const forcedModel = c.req.header('x-gateway-force-model') ?? undefined;

  let registry = getModelRegistry(c.env);
  if (forcedProvider) {
    registry = registry.filter((model) => model.provider === forcedProvider);
  }

  if (registry.length === 0) {
    await recordGatewayRequest(c.env, {
      endpoint,
      projectId,
      requestId,
      reasoningEffort: normalized.reasoning_effort,
      stream: normalized.stream,
      promptChars,
      messageCount,
      statusCode: 503,
      outcome: 'error',
      attempts: 0,
      errorType: 'configuration_error',
      latencyMs: Date.now() - requestStartedAt,
    });

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
  const selected = selectCandidates(registry, stateMap, {
    requestedReasoning: normalized.reasoning_effort,
    stream: normalized.stream,
    now,
    modelOverride: forcedModel,
  });

  if (selected.length === 0) {
    await recordGatewayRequest(c.env, {
      endpoint,
      projectId,
      requestId,
      reasoningEffort: normalized.reasoning_effort,
      stream: normalized.stream,
      promptChars,
      messageCount,
      statusCode: 503,
      outcome: 'error',
      attempts: 0,
      errorType: 'no_candidate',
      latencyMs: Date.now() - requestStartedAt,
    });

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

    await recordGatewayRequest(c.env, {
      endpoint,
      projectId,
      requestId,
      reasoningEffort: normalized.reasoning_effort,
      stream: true,
      promptChars,
      messageCount,
      statusCode: 200,
      outcome: 'ok',
      attempts: chosenMeta?.attempts ?? attemptCounter,
      provider: chosenMeta?.provider,
      model: chosenMeta?.model,
      latencyMs: Date.now() - requestStartedAt,
    });

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

    await recordGatewayRequest(c.env, {
      endpoint,
      projectId,
      requestId,
      reasoningEffort: normalized.reasoning_effort,
      stream: false,
      promptChars,
      messageCount,
      statusCode: 200,
      outcome: 'ok',
      attempts: chosenMeta.attempts,
      provider: chosenMeta.provider,
      model: chosenMeta.model,
      latencyMs: Date.now() - requestStartedAt,
    });

    return c.json(finalResponse as never, 200);
  }

  const status = lastErrorClass === 'input_nonretriable' ? 400 : lastErrorClass === 'usage_retriable' ? 429 : 502;

  await recordGatewayRequest(c.env, {
    endpoint,
    projectId,
    requestId,
    reasoningEffort: normalized.reasoning_effort,
    stream: normalized.stream,
    promptChars,
    messageCount,
    statusCode: status,
    outcome: 'error',
    attempts: chosenMeta?.attempts ?? attemptCounter,
    provider: chosenMeta?.provider,
    model: chosenMeta?.model,
    errorType: lastErrorClass,
    latencyMs: Date.now() - requestStartedAt,
  });

  return c.json(
    {
      error: {
        message: lastErrorMessage,
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
    401: {
      description: 'Unauthorized',
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
      return c.json(parsed as never, proxiedResponse.status as 400 | 401 | 429 | 503);
    }

    return c.json(
      {
        error: {
          message: proxiedText || 'Upstream error',
          type: 'provider_fatal',
        },
      },
      proxiedResponse.status as 400 | 401 | 429 | 503,
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
    401: {
      description: 'Unauthorized',
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
  const forcedProvider = getForcedProvider(c);
  const forcedModel = c.req.header('x-gateway-force-model') ?? undefined;
  const headerProjectId = c.req.header('x-gateway-project-id') ?? undefined;
  const projectId = resolveProjectId(headerProjectId, body.project_id);

  if (headerProjectId && !projectId) {
    await recordGatewayRequest(c.env, {
      endpoint: 'embeddings',
      projectId: undefined,
      requestId,
      reasoningEffort: 'auto',
      stream: false,
      promptChars: inputChars,
      messageCount: normalizedInput.length,
      statusCode: 400,
      outcome: 'error',
      attempts: 0,
      errorType: 'invalid_project_id',
      latencyMs: Date.now() - requestStartedAt,
    });

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

  if (normalizedInput.length === 0) {
    await recordGatewayRequest(c.env, {
      endpoint: 'embeddings',
      projectId,
      requestId,
      reasoningEffort: 'auto',
      stream: false,
      promptChars: 0,
      messageCount: 0,
      statusCode: 400,
      outcome: 'error',
      attempts: 0,
      errorType: 'missing_input',
      latencyMs: Date.now() - requestStartedAt,
    });

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
    requestedModel: body.model,
    forcedProvider,
    forcedModel,
  });

  if (candidates.length === 0) {
    await recordGatewayRequest(c.env, {
      endpoint: 'embeddings',
      projectId,
      requestId,
      reasoningEffort: 'auto',
      stream: false,
      promptChars: inputChars,
      messageCount: normalizedInput.length,
      statusCode: 503,
      outcome: 'error',
      attempts: 0,
      errorType: 'no_embedding_provider',
      latencyMs: Date.now() - requestStartedAt,
    });

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

  await pRetry(
    async () => {
      const candidate = candidates[attemptCounter];
      if (!candidate || attemptCounter >= 2) {
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

  if (finalResponse && chosenMeta) {
    await recordGatewayRequest(c.env, {
      endpoint: 'embeddings',
      projectId,
      requestId,
      reasoningEffort: 'auto',
      stream: false,
      promptChars: inputChars,
      messageCount: normalizedInput.length,
      statusCode: 200,
      outcome: 'ok',
      attempts: chosenMeta.attempts,
      provider: chosenMeta.provider,
      model: chosenMeta.model,
      latencyMs: Date.now() - requestStartedAt,
    });

    return c.json(finalResponse as never, 200);
  }

  const status = lastErrorClass === 'input_nonretriable' ? 400 : lastErrorClass === 'usage_retriable' ? 429 : 502;
  await recordGatewayRequest(c.env, {
    endpoint: 'embeddings',
    projectId,
    requestId,
    reasoningEffort: 'auto',
    stream: false,
    promptChars: inputChars,
    messageCount: normalizedInput.length,
    statusCode: status,
    outcome: 'error',
    attempts: attemptCounter,
    errorType: lastErrorClass,
    latencyMs: Date.now() - requestStartedAt,
  });

  return c.json(
    {
      error: {
        message: lastErrorMessage,
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

const analyticsRoute = createRoute({
  method: 'get',
  path: '/v1/analytics',
  request: {
    query: analyticsQuerySchema,
  },
  responses: {
    200: {
      description: 'Gateway analytics',
      content: {
        'application/json': {
          schema: analyticsResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid query parameters',
      content: {
        'application/json': { schema: errorSchema },
      },
    },
    503: {
      description: 'Analytics storage unavailable',
      content: {
        'application/json': { schema: errorSchema },
      },
    },
  },
});

app.openapi(analyticsRoute, async (c) => {
  if (!c.env.GATEWAY_DB) {
    return c.json(
      {
        error: {
          message: 'D1 analytics storage is not configured',
          type: 'configuration_error',
        },
      },
      503,
    );
  }

  const query = c.req.valid('query');
  const defaults = defaultAnalyticsRange();
  const dateFrom = query.date_from ?? defaults.dateFrom;
  const dateTo = query.date_to ?? defaults.dateTo;

  if (!isValidIsoDate(dateFrom) || !isValidIsoDate(dateTo)) {
    return c.json(
      {
        error: {
          message: 'date_from/date_to must be valid YYYY-MM-DD values',
          type: 'invalid_request_error',
          code: 'invalid_date',
        },
      },
      400,
    );
  }

  if (dateFrom > dateTo) {
    return c.json(
      {
        error: {
          message: 'date_from must be less than or equal to date_to',
          type: 'invalid_request_error',
          code: 'invalid_date_range',
        },
      },
      400,
    );
  }

  const days = countDaysInclusive(dateFrom, dateTo);
  if (days > MAX_ANALYTICS_DAYS) {
    return c.json(
      {
        error: {
          message: `date range too wide. Maximum is ${MAX_ANALYTICS_DAYS} days`,
          type: 'invalid_request_error',
          code: 'date_range_too_large',
        },
      },
      400,
    );
  }

  const bindings: Array<string | number> = [dateFrom, dateTo];
  const filters = ['substr(received_at, 1, 10) >= ?1', 'substr(received_at, 1, 10) <= ?2'];

  if (query.project_id) {
    filters.push(`project_id = ?${bindings.length + 1}`);
    bindings.push(query.project_id);
  }

  const whereClause = filters.join(' AND ');
  const totals = await c.env.GATEWAY_DB.prepare(
    `
    SELECT
      COUNT(*) AS total_requests,
      SUM(CASE WHEN outcome = 'ok' THEN 1 ELSE 0 END) AS ok_requests,
      SUM(CASE WHEN outcome = 'error' THEN 1 ELSE 0 END) AS error_requests,
      AVG(CAST(attempts AS REAL)) AS avg_attempts,
      AVG(CASE WHEN latency_ms IS NOT NULL THEN CAST(latency_ms AS REAL) END) AS avg_latency_ms
    FROM gateway_requests
    WHERE ${whereClause}
    `,
  )
    .bind(...bindings)
    .first<{
      total_requests: number | null;
      ok_requests: number | null;
      error_requests: number | null;
      avg_attempts: number | null;
      avg_latency_ms: number | null;
    }>();

  const byDayResult = await c.env.GATEWAY_DB.prepare(
    `
    SELECT
      substr(received_at, 1, 10) AS usage_date,
      COUNT(*) AS total_requests,
      SUM(CASE WHEN outcome = 'ok' THEN 1 ELSE 0 END) AS ok_requests,
      SUM(CASE WHEN outcome = 'error' THEN 1 ELSE 0 END) AS error_requests,
      SUM(attempts) AS total_attempts
    FROM gateway_requests
    WHERE ${whereClause}
    GROUP BY usage_date
    ORDER BY usage_date ASC
    `,
  )
    .bind(...bindings)
    .all<{
      usage_date: string;
      total_requests: number | null;
      ok_requests: number | null;
      error_requests: number | null;
      total_attempts: number | null;
    }>();

  const byProviderResult = await c.env.GATEWAY_DB.prepare(
    `
    SELECT
      COALESCE(chosen_provider, 'unknown') AS provider,
      COUNT(*) AS total_requests,
      SUM(CASE WHEN outcome = 'ok' THEN 1 ELSE 0 END) AS ok_requests,
      SUM(CASE WHEN outcome = 'error' THEN 1 ELSE 0 END) AS error_requests,
      AVG(CASE WHEN latency_ms IS NOT NULL THEN CAST(latency_ms AS REAL) END) AS avg_latency_ms
    FROM gateway_requests
    WHERE ${whereClause}
    GROUP BY provider
    ORDER BY total_requests DESC
    LIMIT ?${bindings.length + 1}
    `,
  )
    .bind(...bindings, query.limit)
    .all<{
      provider: string;
      total_requests: number | null;
      ok_requests: number | null;
      error_requests: number | null;
      avg_latency_ms: number | null;
    }>();

  const byReasoningResult = await c.env.GATEWAY_DB.prepare(
    `
    SELECT
      reasoning_effort,
      COUNT(*) AS total_requests
    FROM gateway_requests
    WHERE ${whereClause}
    GROUP BY reasoning_effort
    ORDER BY total_requests DESC
    `,
  )
    .bind(...bindings)
    .all<{ reasoning_effort: string; total_requests: number | null }>();

  const byEndpointResult = await c.env.GATEWAY_DB.prepare(
    `
    SELECT
      endpoint,
      COUNT(*) AS total_requests,
      SUM(CASE WHEN outcome = 'ok' THEN 1 ELSE 0 END) AS ok_requests,
      SUM(CASE WHEN outcome = 'error' THEN 1 ELSE 0 END) AS error_requests
    FROM gateway_requests
    WHERE ${whereClause}
    GROUP BY endpoint
    ORDER BY total_requests DESC
    `,
  )
    .bind(...bindings)
    .all<{
      endpoint: string;
      total_requests: number | null;
      ok_requests: number | null;
      error_requests: number | null;
    }>();

  const byProjectResult = await c.env.GATEWAY_DB.prepare(
    `
    SELECT
      COALESCE(project_id, 'unscoped') AS project_id,
      COUNT(*) AS total_requests,
      SUM(CASE WHEN outcome = 'ok' THEN 1 ELSE 0 END) AS ok_requests,
      SUM(CASE WHEN outcome = 'error' THEN 1 ELSE 0 END) AS error_requests
    FROM gateway_requests
    WHERE ${whereClause}
    GROUP BY project_id
    ORDER BY total_requests DESC
    LIMIT ?${bindings.length + 1}
    `,
  )
    .bind(...bindings, query.limit)
    .all<{
      project_id: string;
      total_requests: number | null;
      ok_requests: number | null;
      error_requests: number | null;
    }>();

  const totalRequests = toNumber(totals?.total_requests);
  const okRequests = toNumber(totals?.ok_requests);
  const errorRequests = toNumber(totals?.error_requests);

  return c.json(
    {
      ok: true as const,
      range: {
        date_from: dateFrom,
        date_to: dateTo,
        days,
        project_id: query.project_id ?? null,
      },
      totals: {
        total_requests: totalRequests,
        ok_requests: okRequests,
        error_requests: errorRequests,
        success_rate: totalRequests > 0 ? okRequests / totalRequests : 0,
        avg_attempts: Number(toNumber(totals?.avg_attempts).toFixed(3)),
        avg_latency_ms: Number(toNumber(totals?.avg_latency_ms).toFixed(2)),
      },
      by_day: (byDayResult.results ?? []).map((row) => ({
        usage_date: row.usage_date,
        total_requests: toNumber(row.total_requests),
        ok_requests: toNumber(row.ok_requests),
        error_requests: toNumber(row.error_requests),
        total_attempts: toNumber(row.total_attempts),
      })),
      by_provider: (byProviderResult.results ?? []).map((row) => ({
        provider: row.provider,
        total_requests: toNumber(row.total_requests),
        ok_requests: toNumber(row.ok_requests),
        error_requests: toNumber(row.error_requests),
        avg_latency_ms: Number(toNumber(row.avg_latency_ms).toFixed(2)),
      })),
      by_reasoning_effort: (byReasoningResult.results ?? []).map((row) => ({
        reasoning_effort: row.reasoning_effort,
        total_requests: toNumber(row.total_requests),
      })),
      by_endpoint: (byEndpointResult.results ?? []).map((row) => ({
        endpoint: row.endpoint,
        total_requests: toNumber(row.total_requests),
        ok_requests: toNumber(row.ok_requests),
        error_requests: toNumber(row.error_requests),
      })),
      by_project: (byProjectResult.results ?? []).map((row) => ({
        project_id: row.project_id,
        total_requests: toNumber(row.total_requests),
        ok_requests: toNumber(row.ok_requests),
        error_requests: toNumber(row.error_requests),
      })),
    },
    200,
  );
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

const keyRequestRoute = createRoute({
  method: 'post',
  path: '/access/request-key',
  request: {
    body: {
      content: {
        'application/json': {
          schema: keyRequestBodySchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Key request accepted and auto-issued',
      content: {
        'application/json': {
          schema: keyRequestApprovedResponseSchema,
        },
      },
    },
    202: {
      description: 'Key request accepted',
      content: {
        'application/json': {
          schema: keyRequestQueuedResponseSchema,
        },
      },
    },
    429: {
      description: 'Rate limited',
      content: {
        'application/json': { schema: errorSchema },
      },
    },
    500: {
      description: 'Failed to issue key',
      content: {
        'application/json': { schema: errorSchema },
      },
    },
  },
});

app.openapi(keyRequestRoute, async (c) => {
  const body = c.req.valid('json');
  const now = Date.now();
  const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? 'unknown';

  const accessRate = await consumeIpRateLimit(c.env, {
    ipKey: `access:${ip}`,
    now,
    capacity: 5,
    refillPerSecond: 5 / 86400,
  });

  if (!accessRate.allowed) {
    c.header('Retry-After', String(accessRate.retryAfter));
    return c.json(
      {
        error: {
          message: 'Too many access requests from this IP. Try again later.',
          type: 'rate_limit_error',
        },
      },
      429,
    );
  }

  const requestId = createRequestId();
  await storeKeyRequestRecord(c.env, {
    requestId,
    name: body.name,
    email: body.email,
    company: body.company,
    useCase: body.use_case,
    intendedUse: body.intended_use,
    expectedDailyRequests: body.expected_daily_requests,
    sourceIp: ip,
    userAgent: c.req.header('user-agent') ?? undefined,
  });

  const emailDomain = body.email.includes('@') ? body.email.split('@')[1] ?? 'unknown' : 'unknown';
  console.log(
    JSON.stringify({
      event: 'access_request_received',
      request_id: requestId,
      email_domain: emailDomain,
      company: body.company ?? null,
      intended_use: body.intended_use,
      expected_daily_requests: body.expected_daily_requests ?? null,
      use_case_chars: body.use_case.length,
    }),
  );

  const autoIssueEnabled = c.env.AUTO_ISSUE_KEYS === 'true';
  if (autoIssueEnabled) {
    const issuedKey = `fagw_${crypto.randomUUID().replace(/-/g, '')}`;
    const keyHash = await sha256Hex(issuedKey);

    try {
      await storeIssuedKeyRecord(c.env, {
        requestId,
        issuedKey,
        keyHash,
        email: body.email,
        intendedUse: body.intended_use,
        expectedDailyRequests: body.expected_daily_requests,
      });
    } catch (error) {
      console.log(
        JSON.stringify({
          event: 'access_key_issue_error',
          request_id: requestId,
          message: getErrorMessage(error),
        }),
      );

      return c.json(
        {
          error: {
            message: 'Request was received but key issuance failed. Try again shortly.',
            type: 'storage_error',
          },
        },
        500,
      );
    }

    console.log(
      JSON.stringify({
        event: 'access_request_auto_approved',
        request_id: requestId,
        key_hash_prefix: keyHash.slice(0, 10),
      }),
    );

    return c.json(
      {
        ok: true as const,
        request_id: requestId,
        status: 'approved' as const,
        api_key: issuedKey,
        message: 'API key issued. Store it securely; it is shown only once.',
      },
      201,
    );
  }

  return c.json(
      {
        ok: true as const,
        request_id: requestId,
        status: 'queued' as const,
        message: 'Request received. Review this request_id in storage and issue a gateway key manually.',
      },
      202,
    );
});

app.doc('/openapi.json', {
  openapi: '3.0.0',
  info: {
    title: 'Free AI Gateway API',
    version: '1.0.0',
    description:
      'OpenAI-compatible text gateway with health-aware free-tier routing across Workers AI, Groq, Gemini and optional OpenRouter/Cerebras.',
  },
});

app.get('/docs', swaggerUI({ url: '/openapi.json' }));

app.get('/playground', (c) => {
  if (!isPlaygroundEnabled(c.env)) {
    return c.text('Not Found', 404);
  }

  return c.html(renderPlaygroundHtml());
});

app.get('/', (c) => {
  const payload = {
    service: 'free-ai-gateway',
    version: '1.0.0',
    endpoints: [
      '/v1/chat/completions',
      '/v1/responses',
      '/v1/embeddings',
      '/v1/models',
      '/v1/analytics',
      '/health',
      '/openapi.json',
      '/docs',
      '/access/request-key',
    ],
  };

  const accept = c.req.header('accept')?.toLowerCase() ?? '';
  if (accept.includes('application/json')) {
    return c.json(payload);
  }

  return c.html(
    renderLandingHtml({
      playgroundEnabled: isPlaygroundEnabled(c.env),
    }),
  );
});

export default app;
export { HealthStateDO, IpRateLimitDO };
