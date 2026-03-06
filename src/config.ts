import type { Env, ModelCandidate, Provider, ProviderLimitConfig, ReasoningEffort, ReasoningTier, TextProvider } from './types';

const DEFAULT_MODELS: ModelCandidate[] = [
  {
    id: 'workers-ai-llama-8b',
    provider: 'workers_ai',
    model: '@cf/meta/llama-3.1-8b-instruct',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    phase: 1,
    priority: 0.92,
  },
  {
    id: 'workers-ai-mistral-7b',
    provider: 'workers_ai',
    model: '@cf/mistral/mistral-7b-instruct-v0.1',
    reasoning: 'low',
    supportsStreaming: true,
    enabled: true,
    phase: 1,
    priority: 0.88,
  },
  {
    id: 'groq-llama-8b',
    provider: 'groq',
    model: 'llama-3.1-8b-instant',
    reasoning: 'low',
    supportsStreaming: true,
    enabled: true,
    phase: 1,
    priority: 0.91,
  },
  {
    id: 'groq-llama-70b',
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    phase: 1,
    priority: 0.8,
  },
  {
    id: 'gemini-2.0-flash-lite',
    provider: 'gemini',
    model: 'gemini-2.0-flash-lite',
    reasoning: 'low',
    supportsStreaming: true,
    enabled: true,
    phase: 1,
    priority: 0.84,
  },
  {
    id: 'gemini-2.0-flash',
    provider: 'gemini',
    model: 'gemini-2.0-flash',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    phase: 1,
    priority: 0.89,
  },
  {
    id: 'openrouter-free',
    provider: 'openrouter',
    model: 'openrouter/free',
    reasoning: 'low',
    supportsStreaming: true,
    enabled: false,
    phase: 2,
    priority: 0.7,
  },
  {
    id: 'cerebras-qwen-32b',
    provider: 'cerebras',
    model: 'qwen-3-32b',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: false,
    phase: 2,
    priority: 0.74,
  },
  {
    id: 'cli-bridge-default',
    provider: 'cli_bridge',
    model: 'default',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    phase: 1,
    priority: 0.65,
  },
];

const DEFAULT_LIMITS: Record<string, ProviderLimitConfig> = {
  'workers_ai:@cf/meta/llama-3.1-8b-instruct': { requestsPerDay: 300 },
  'workers_ai:@cf/mistral/mistral-7b-instruct-v0.1': { requestsPerDay: 500 },
  'groq:llama-3.1-8b-instant': { requestsPerDay: 1500 },
  'groq:llama-3.3-70b-versatile': { requestsPerDay: 300 },
  'gemini:gemini-2.0-flash-lite': { requestsPerDay: 1500 },
  'gemini:gemini-2.0-flash': { requestsPerDay: 600 },
  'openrouter:openrouter/free': { requestsPerDay: 50 },
  'cerebras:qwen-3-32b': { requestsPerDay: 500 },
  'cli_bridge:default': { requestsPerDay: 10000 },
};

export interface RateLimitConfig {
  capacity: number;
  refillPerSecond: number;
}

const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  capacity: 10,
  refillPerSecond: 20 / 60,
};

const PROVIDER_KEY_REQUIRED: Record<TextProvider, boolean> = {
  workers_ai: false,
  groq: true,
  gemini: true,
  openrouter: true,
  cerebras: true,
  cli_bridge: true,
};

function safeParse<T>(value: string | undefined): T | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function hasProviderKey(env: Env, provider: TextProvider): boolean {
  switch (provider) {
    case 'workers_ai':
      return true;
    case 'groq':
      return Boolean(env.GROQ_API_KEY);
    case 'gemini':
      return Boolean(env.GEMINI_API_KEY);
    case 'openrouter':
      return Boolean(env.OPENROUTER_API_KEY);
    case 'cerebras':
      return Boolean(env.CEREBRAS_API_KEY);
    case 'cli_bridge':
      return Boolean(env.CLI_BRIDGE_URL);
    default:
      return false;
  }
}

export function getModelRegistry(env: Env): ModelCandidate[] {
  const configured = safeParse<ModelCandidate[]>(env.MODEL_REGISTRY_JSON);
  const base = configured && configured.length > 0 ? configured : DEFAULT_MODELS;
  const phase2Enabled = env.ENABLE_PHASE2 === 'true';

  return base.filter((candidate) => {
    if (!candidate.enabled) {
      return false;
    }

    if (candidate.phase === 2 && !phase2Enabled) {
      return false;
    }

    if (PROVIDER_KEY_REQUIRED[candidate.provider] && !hasProviderKey(env, candidate.provider)) {
      return false;
    }

    return true;
  });
}

export function getProviderLimits(env: Env): Record<string, ProviderLimitConfig> {
  return safeParse<Record<string, ProviderLimitConfig>>(env.PROVIDER_LIMITS_JSON) ?? DEFAULT_LIMITS;
}

export function getRateLimitConfig(env: Env): RateLimitConfig {
  return safeParse<RateLimitConfig>(env.RATE_LIMIT_CONFIG_JSON) ?? DEFAULT_RATE_LIMIT;
}

export function getTierOrder(reasoning: ReasoningEffort): ReasoningTier[] {
  switch (reasoning) {
    case 'low':
      return ['low', 'medium', 'high'];
    case 'high':
      return ['high', 'medium', 'low'];
    case 'medium':
      return ['medium', 'high', 'low'];
    case 'auto':
    default:
      return ['medium', 'low', 'high'];
  }
}

export function getModelKey(provider: Provider, model: string): string {
  return `${provider}:${model}`;
}