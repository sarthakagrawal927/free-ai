import { describe, expect, it } from 'vitest';
import { computeScore, selectCandidates } from '../src/router/select-model';
import type { ModelCandidate, ModelStateSnapshot } from '../src/types';

const registry: ModelCandidate[] = [
  {
    id: 'a',
    provider: 'groq',
    model: 'model-a',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    phase: 1,
    priority: 0.9,
  },
  {
    id: 'b',
    provider: 'gemini',
    model: 'model-b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    phase: 1,
    priority: 0.8,
  },
  {
    id: 'c',
    provider: 'workers_ai',
    model: 'model-c',
    reasoning: 'low',
    supportsStreaming: false,
    enabled: true,
    phase: 1,
    priority: 0.7,
  },
];

function snapshot(key: string, successRate: number, avgLatencyMs: number, cooldownUntil = 0): ModelStateSnapshot {
  return {
    key,
    attempts: 10,
    successRate,
    avgLatencyMs,
    cooldownUntil,
    headroom: 0.9,
    dailyUsed: 10,
    dailyLimit: 100,
    shortRetriableFailures: 0,
  };
}

describe('computeScore', () => {
  it('prefers higher success rate over lower latency when close', () => {
    const highSuccess = computeScore('medium', registry[0], snapshot('groq:model-a', 0.95, 1800));
    const lowSuccessFast = computeScore('medium', registry[1], snapshot('gemini:model-b', 0.55, 300));
    expect(highSuccess).toBeGreaterThan(lowSuccessFast);
  });
});

describe('selectCandidates', () => {
  it('filters out non-streaming candidates for stream requests', () => {
    const selected = selectCandidates(registry, new Map(), {
      requestedReasoning: 'medium',
      stream: true,
      now: Date.now(),
    });

    expect(selected.some((candidate) => candidate.provider === 'workers_ai')).toBe(false);
  });

  it('filters out cooldowned candidates', () => {
    const now = Date.now();
    const selected = selectCandidates(
      registry,
      new Map([
        ['groq:model-a', snapshot('groq:model-a', 0.95, 500, now + 30_000)],
        ['gemini:model-b', snapshot('gemini:model-b', 0.8, 500, 0)],
      ]),
      {
        requestedReasoning: 'medium',
        stream: false,
        now,
      },
    );

    expect(selected[0]?.provider).toBe('gemini');
  });
});
