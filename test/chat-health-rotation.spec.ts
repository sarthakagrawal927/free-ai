import { beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../src/index';
import type { ModelCandidate } from '../src/types';
import { makeCtx, makeTestEnv } from './helpers/env';

const mocks = vi.hoisted(() => ({ registry: [] as ModelCandidate[], call: vi.fn() }));
vi.mock('../src/config', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  getModelRegistry: () => mocks.registry,
}));
vi.mock('../src/providers', async (original) => {
  const actual = await original<Record<string, unknown>>();
  return {
    ...actual,
    providerCallers: {
      ...(actual.providerCallers as object),
      groq: mocks.call,
      workers_ai: mocks.call,
    },
  };
});
function candidate(model: string, provider: 'groq' | 'workers_ai' = 'groq'): ModelCandidate {
  return {
    id: model,
    model,
    provider,
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 1,
    capabilities: {
      toolCalling: true,
      jsonMode: true,
      vision: false,
      contextWindow: 32000,
      maxOutputTokens: 4096,
    },
  };
}
function health(model: string, successRate = 1, provider = 'groq') {
  return {
    key: `${provider}:${model}`,
    attempts: 10,
    successRate,
    avgLatencyMs: 100,
    p90LatencyMs: 100,
    p99LatencyMs: 100,
    cooldownUntil: 0,
    headroom: 1,
    dailyUsed: 0,
    dailyLimit: 100,
    shortRetriableFailures: 0,
  };
}
async function request(offset: number, snapshots: unknown[]) {
  const { env } = makeTestEnv({
    GROQ_API_KEY: 'synthetic',
    healthSnapshots: snapshots,
    roundRobinOffset: offset,
  });
  return app.fetch(
    new Request('https://gateway.test/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer test-gateway-key' },
      body: JSON.stringify({
        model: 'auto',
        project_id: 'rotation-regression',
        stream: false,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: 'Return JSON.' }],
      }),
    }),
    env,
    makeCtx()
  );
}
describe('chat automatic health rotation', () => {
  beforeEach(() => {
    mocks.call.mockReset();
    mocks.call.mockImplementation(async ({ provider, model }) => ({
      provider,
      model,
      stream: false,
      completion: {
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: '{"ok":true}' },
            finish_reason: 'stop',
          },
        ],
      },
    }));
  });
  it('does not rotate low-success models ahead of healthy peers', async () => {
    mocks.registry = [candidate('healthy-a'), candidate('healthy-b'), candidate('failing')];
    const response = await request(2, [
      health('healthy-a'),
      health('healthy-b'),
      health('failing', 0),
    ]);
    expect(response.status).toBe(200);
    expect(mocks.call.mock.calls[0][0].model).toBe('healthy-a');
  });
  it('still distributes requests between healthy peers', async () => {
    mocks.registry = [candidate('healthy-a'), candidate('healthy-b')];
    await request(1, [health('healthy-a'), health('healthy-b')]);
    expect(mocks.call.mock.calls[0][0].model).toBe('healthy-b');
  });
  it('preserves ordering when no healthy history exists', async () => {
    mocks.registry = [candidate('unmeasured-a'), candidate('unmeasured-b')];
    await request(1, []);
    expect(mocks.call.mock.calls[0][0].model).toBe('unmeasured-a');
  });
  it('does not rotate a temporarily degraded peer ahead of a healthy one', async () => {
    mocks.registry = [candidate('healthy-a'), candidate('slow')];
    await request(1, [health('healthy-a'), { ...health('slow'), avgLatencyMs: 10000 }]);
    expect(mocks.call.mock.calls[0][0].model).toBe('healthy-a');
  });
  it('retains JSON capability filtering before peer rotation', async () => {
    const incompatible = candidate('plain-text');
    incompatible.capabilities.jsonMode = false;
    mocks.registry = [candidate('healthy-a'), incompatible, candidate('failing')];
    await request(1, [health('healthy-a'), health('plain-text'), health('failing', 0)]);
    expect(mocks.call.mock.calls[0][0].model).toBe('healthy-a');
  });
  it('preserves the selected reasoning-tier boundary', async () => {
    const otherTier = candidate('other-tier');
    otherTier.reasoning = 'high';
    mocks.registry = [candidate('healthy-a'), otherTier];
    await request(1, [health('healthy-a'), health('other-tier')]);
    expect(mocks.call.mock.calls[0][0].model).toBe('healthy-a');
  });
  it('continues to the next healthy peer after a retriable failure', async () => {
    mocks.registry = [
      candidate('healthy-a'),
      candidate('healthy-b'),
      candidate('fallback', 'workers_ai'),
    ];
    mocks.call.mockRejectedValueOnce(Object.assign(new Error('server error'), { status: 500 }));
    const response = await request(1, [
      health('healthy-a'),
      health('healthy-b'),
      health('fallback', 1, 'workers_ai'),
    ]);
    expect(response.status).toBe(200);
    expect(mocks.call.mock.calls.map(([input]) => input.model)).toEqual(['healthy-b', 'healthy-a']);
  });
  it('never rotates Workers AI ahead of available external providers', async () => {
    mocks.registry = [candidate('healthy-a'), candidate('fallback', 'workers_ai')];
    const response = await request(1, [health('healthy-a'), health('fallback', 1, 'workers_ai')]);
    expect(response.status).toBe(200);
    expect(mocks.call.mock.calls[0][0].provider).toBe('groq');
  });
});
