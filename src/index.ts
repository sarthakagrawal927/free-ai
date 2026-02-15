import { swaggerUI } from '@hono/swagger-ui';
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { bearerAuth } from 'hono/bearer-auth';
import pLimit from 'p-limit';
import pRetry from 'p-retry';
import { AbortError } from 'p-retry';
import { getModelKey, getModelRegistry, getProviderLimits, getRateLimitConfig, isPlaygroundEnabled } from './config';
import { providerCallers } from './providers';
import { classifyError, isRetriableFailure } from './router/classify-error';
import { selectCandidates } from './router/select-model';
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

const chatRequestSchema = z
  .object({
    model: z.string().default('auto'),
    messages: z.array(messageSchema).optional(),
    prompt: z.string().optional(),
    stream: z.boolean().default(false),
    temperature: z.number().min(0).max(2).optional(),
    max_tokens: z.number().int().min(1).max(8192).optional(),
    reasoning_effort: z.enum(['auto', 'low', 'medium', 'high']).default('auto'),
  })
  .openapi('ChatCompletionRequest');

const gatewayMetaSchema = z
  .object({
    provider: z.enum(['workers_ai', 'groq', 'gemini', 'openrouter', 'cerebras', 'cli_bridge']),
    model: z.string(),
    attempts: z.number().int().min(1),
    reasoning_effort: z.enum(['auto', 'low', 'medium', 'high']),
    request_id: z.string(),
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

const authMiddleware = bearerAuth({
  verifyToken: async (token, c) => token === c.env.GATEWAY_API_KEY,
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
}): GatewayMeta {
  return {
    provider: params.provider,
    model: params.model,
    attempts: params.attempts,
    reasoning_effort: params.reasoning,
    request_id: params.requestId,
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
  const body = c.req.valid('json');
  const requestId = createRequestId();
  const normalizedMessages = normalizeMessages(body.messages, body.prompt);

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

  const forcedProvider = getForcedProvider(c);
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
  const selected = selectCandidates(registry, stateMap, {
    requestedReasoning: normalized.reasoning_effort,
    stream: normalized.stream,
    now,
    modelOverride: forcedModel,
  });

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
        provider: chosenMeta.provider,
        model: chosenMeta.model,
        attempts: chosenMeta.attempts,
        status: 'ok',
      }),
    );

    return c.json(finalResponse as never, 200);
  }

  const status = lastErrorClass === 'input_nonretriable' ? 400 : lastErrorClass === 'usage_retriable' ? 429 : 502;

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

app.get('/', (c) =>
  c.json({
    service: 'free-ai-gateway',
    version: '1.0.0',
    endpoints: ['/v1/chat/completions', '/v1/models', '/health', '/openapi.json', '/docs'],
  }),
);

export default app;
export { HealthStateDO, IpRateLimitDO };
