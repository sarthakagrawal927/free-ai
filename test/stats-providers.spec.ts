import { describe, expect, it } from 'vitest';

import app from '../src/index';
import { makeCtx, makeTestEnv } from './helpers/env';

describe('GET /v1/stats/providers', () => {
  it('returns { stats: [] } when there are no stats', async () => {
    const { env } = makeTestEnv();
    const req = new Request('https://gateway.test/v1/stats/providers', { method: 'GET' });

    const res = await app.fetch(req, env, makeCtx());
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type') ?? '').toContain('application/json');

    const body = (await res.json()) as { stats: unknown[] };
    expect(Array.isArray(body.stats)).toBe(true);
    expect(body.stats).toEqual([]);
  });

  it('returns the ProviderStats array aggregated from the health DO', async () => {
    const providerStats = [
      {
        provider: 'groq',
        total_models: 3,
        active_models: 2,
        total_attempts: 100,
        throttle_count: 5,
        throttle_rate: 0.05,
        success_rate: 0.9,
        avg_latency_ms: 320,
        cooldown_events: 1,
        models_in_cooldown: 0,
        failure_breakdown: {
          safety_refusal: 0,
          usage_retriable: 5,
          input_nonretriable: 2,
          provider_fatal: 1,
        },
        avg_attempts_before_first_throttle: 20,
        throttle_spacing_p50: 1000,
      },
    ];

    const { env } = makeTestEnv({ providerStats });
    const req = new Request('https://gateway.test/v1/stats/providers', { method: 'GET' });

    const res = await app.fetch(req, env, makeCtx());
    expect(res.status).toBe(200);

    const body = (await res.json()) as { stats: unknown[] };
    expect(body).toHaveProperty('stats');
    expect(body.stats).toHaveLength(1);
    expect(body.stats[0]).toMatchObject({ provider: 'groq', total_models: 3, success_rate: 0.9 });
  });

  it('does not require any authentication headers (public endpoint)', async () => {
    const { env } = makeTestEnv();
    // Intentionally no Authorization, no x-gateway-project-id.
    const req = new Request('https://gateway.test/v1/stats/providers', { method: 'GET' });

    const res = await app.fetch(req, env, makeCtx());
    expect(res.status).toBe(200);
  });
});
