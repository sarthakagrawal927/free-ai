import { describe, expect, it } from 'vitest';
import { computeScore, deriveRequiredCapabilities, selectCandidates } from '../src/router/select-model';
import type { ModelCandidate, ModelStateSnapshot } from '../src/types';

const defaultCaps = { toolCalling: false, jsonMode: false, vision: false, contextWindow: 8192, maxOutputTokens: 4096 };
const agentCaps = { toolCalling: true, jsonMode: true, vision: false, contextWindow: 131072, maxOutputTokens: 8192 };
const visionCaps = { toolCalling: true, jsonMode: true, vision: true, contextWindow: 131072, maxOutputTokens: 8192 };

const registry: ModelCandidate[] = [
  {
    id: 'a',
    provider: 'groq',
    model: 'model-a',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.9,
    capabilities: agentCaps,
  },
  {
    id: 'b',
    provider: 'gemini',
    model: 'model-b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.8,
    capabilities: visionCaps,
  },
  {
    id: 'c',
    provider: 'workers_ai',
    model: 'model-c',
    reasoning: 'low',
    supportsStreaming: false,
    enabled: true,
    priority: 0.7,
    capabilities: defaultCaps,
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

  it('filters out models without tool calling when tools are required', () => {
    const selected = selectCandidates(registry, new Map(), {
      requestedReasoning: 'medium',
      stream: false,
      now: Date.now(),
      requiredCapabilities: { toolCalling: true },
    });

    expect(selected.every((c) => c.capabilities.toolCalling)).toBe(true);
    expect(selected.some((c) => c.provider === 'workers_ai')).toBe(false);
  });

  it('filters out models without json mode when json_object is required', () => {
    const selected = selectCandidates(registry, new Map(), {
      requestedReasoning: 'medium',
      stream: false,
      now: Date.now(),
      requiredCapabilities: { jsonMode: true },
    });

    expect(selected.every((c) => c.capabilities.jsonMode)).toBe(true);
    expect(selected.some((c) => c.provider === 'workers_ai')).toBe(false);
  });

  it('filters out models without vision when vision is required', () => {
    const selected = selectCandidates(registry, new Map(), {
      requestedReasoning: 'medium',
      stream: false,
      now: Date.now(),
      requiredCapabilities: { vision: true },
    });

    expect(selected.every((c) => c.capabilities.vision)).toBe(true);
    expect(selected.length).toBe(1);
    expect(selected[0].provider).toBe('gemini');
  });

  it('returns all candidates when no capabilities are required', () => {
    const selected = selectCandidates(registry, new Map(), {
      requestedReasoning: 'auto',
      stream: false,
      now: Date.now(),
    });

    expect(selected.length).toBe(3);
  });
});

describe('deriveRequiredCapabilities', () => {
  it('returns toolCalling when tools are present', () => {
    const caps = deriveRequiredCapabilities({
      tools: [{ type: 'function', function: { name: 'get_weather' } }],
    });
    expect(caps.toolCalling).toBe(true);
    expect(caps.jsonMode).toBeUndefined();
  });

  it('returns jsonMode when response_format is json_object', () => {
    const caps = deriveRequiredCapabilities({
      response_format: { type: 'json_object' },
    });
    expect(caps.jsonMode).toBe(true);
    expect(caps.toolCalling).toBeUndefined();
  });

  it('returns empty when no special requirements', () => {
    const caps = deriveRequiredCapabilities({});
    expect(caps.toolCalling).toBeUndefined();
    expect(caps.jsonMode).toBeUndefined();
    expect(caps.vision).toBeUndefined();
  });

  it('detects vision when messages contain image_url parts', () => {
    const caps = deriveRequiredCapabilities({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is in this image?' },
            { type: 'image_url', image_url: { url: 'https://example.com/img.png' } },
          ],
        },
      ],
    });
    expect(caps.vision).toBe(true);
  });

  it('does not set vision for text-only messages', () => {
    const caps = deriveRequiredCapabilities({
      messages: [{ role: 'user', content: 'Hello' }],
    });
    expect(caps.vision).toBeUndefined();
  });

  it('estimates minContextWindow from message length', () => {
    const longContent = 'x'.repeat(40_000); // ~10K tokens
    const caps = deriveRequiredCapabilities({
      messages: [{ role: 'user', content: longContent }],
    });
    expect(caps.minContextWindow).toBeGreaterThan(10_000);
  });
});

describe('selectCandidates — context window filtering', () => {
  const smallCtxModel: ModelCandidate = {
    id: 'small-ctx',
    provider: 'workers_ai',
    model: 'small',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.9,
    capabilities: { toolCalling: false, jsonMode: false, vision: false, contextWindow: 2048, maxOutputTokens: 1024 },
  };

  const largeCtxModel: ModelCandidate = {
    id: 'large-ctx',
    provider: 'groq',
    model: 'large',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.8,
    capabilities: { toolCalling: true, jsonMode: true, vision: false, contextWindow: 131072, maxOutputTokens: 8192 },
  };

  it('filters out models with insufficient context window', () => {
    const selected = selectCandidates([smallCtxModel, largeCtxModel], new Map(), {
      requestedReasoning: 'medium',
      stream: false,
      now: Date.now(),
      requiredCapabilities: { minContextWindow: 10_000 },
    });

    expect(selected.length).toBe(1);
    expect(selected[0].id).toBe('large-ctx');
  });

  it('keeps all models when context requirement is small', () => {
    const selected = selectCandidates([smallCtxModel, largeCtxModel], new Map(), {
      requestedReasoning: 'medium',
      stream: false,
      now: Date.now(),
      requiredCapabilities: { minContextWindow: 1000 },
    });

    expect(selected.length).toBe(2);
  });
});
