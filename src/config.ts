import type { Env, ModelCandidate, Provider, ProviderLimitConfig, ReasoningEffort, ReasoningTier, TextProvider } from './types';

const DEFAULT_MODELS: ModelCandidate[] = [
  // ── Workers AI (free via Cloudflare binding / REST) ─────────────────
  {
    id: 'workers-ai-llama-3.3-70b',
    provider: 'workers_ai',
    model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    phase: 1,
    priority: 0.93,
  },
  {
    id: 'workers-ai-deepseek-r1-32b',
    provider: 'workers_ai',
    model: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    phase: 1,
    priority: 0.90,
  },
  {
    id: 'workers-ai-qwen-14b',
    provider: 'workers_ai',
    model: '@cf/qwen/qwen1.5-14b-chat-awq',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    phase: 1,
    priority: 0.85,
  },
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
    id: 'workers-ai-gemma-7b',
    provider: 'workers_ai',
    model: '@cf/google/gemma-7b-it-lora',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    phase: 1,
    priority: 0.82,
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
    id: 'workers-ai-llama-3b',
    provider: 'workers_ai',
    model: '@cf/meta/llama-3.2-3b-instruct',
    reasoning: 'low',
    supportsStreaming: true,
    enabled: true,
    phase: 1,
    priority: 0.83,
  },
  {
    id: 'workers-ai-llama-1b',
    provider: 'workers_ai',
    model: '@cf/meta/llama-3.2-1b-instruct',
    reasoning: 'low',
    supportsStreaming: true,
    enabled: true,
    phase: 1,
    priority: 0.78,
  },
  {
    id: 'workers-ai-phi-2',
    provider: 'workers_ai',
    model: '@cf/microsoft/phi-2',
    reasoning: 'low',
    supportsStreaming: true,
    enabled: true,
    phase: 1,
    priority: 0.75,
  },

  // ── Groq (free tier, rate-limited) ──────────────────────────────────
  {
    id: 'groq-deepseek-r1-70b',
    provider: 'groq',
    model: 'deepseek-r1-distill-llama-70b',
    reasoning: 'high',
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
    priority: 0.89,
  },
  {
    id: 'groq-qwen-qwq-32b',
    provider: 'groq',
    model: 'qwen-qwq-32b',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    phase: 1,
    priority: 0.87,
  },
  {
    id: 'groq-gemma2-9b',
    provider: 'groq',
    model: 'gemma2-9b-it',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    phase: 1,
    priority: 0.86,
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
    id: 'groq-mixtral-8x7b',
    provider: 'groq',
    model: 'mixtral-8x7b-32768',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    phase: 1,
    priority: 0.84,
  },
  {
    id: 'groq-llama3-8b',
    provider: 'groq',
    model: 'llama3-8b-8192',
    reasoning: 'low',
    supportsStreaming: true,
    enabled: true,
    phase: 1,
    priority: 0.80,
  },
  {
    id: 'groq-llama3-70b',
    provider: 'groq',
    model: 'llama3-70b-8192',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    phase: 1,
    priority: 0.82,
  },

  // ── Gemini (free tier, generous limits) ─────────────────────────────
  {
    id: 'gemini-1.5-pro',
    provider: 'gemini',
    model: 'gemini-1.5-pro',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    phase: 1,
    priority: 0.88,
  },
  {
    id: 'gemini-2.0-flash',
    provider: 'gemini',
    model: 'gemini-2.0-flash',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    phase: 1,
    priority: 0.92,
  },
  {
    id: 'gemini-1.5-flash',
    provider: 'gemini',
    model: 'gemini-1.5-flash',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    phase: 1,
    priority: 0.86,
  },
  {
    id: 'gemini-2.0-flash-lite',
    provider: 'gemini',
    model: 'gemini-2.0-flash-lite',
    reasoning: 'low',
    supportsStreaming: true,
    enabled: true,
    phase: 1,
    priority: 0.89,
  },
  {
    id: 'gemini-1.5-flash-8b',
    provider: 'gemini',
    model: 'gemini-1.5-flash-8b',
    reasoning: 'low',
    supportsStreaming: true,
    enabled: true,
    phase: 1,
    priority: 0.84,
  },

  // ── OpenRouter (phase 2, needs OPENROUTER_API_KEY) ──────────────────
  {
    id: 'openrouter-llama-70b-free',
    provider: 'openrouter',
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    phase: 2,
    priority: 0.78,
  },
  {
    id: 'openrouter-qwen-72b-free',
    provider: 'openrouter',
    model: 'qwen/qwen-2.5-72b-instruct:free',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    phase: 2,
    priority: 0.76,
  },
  {
    id: 'openrouter-deepseek-r1-free',
    provider: 'openrouter',
    model: 'deepseek/deepseek-r1:free',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    phase: 2,
    priority: 0.74,
  },
  {
    id: 'openrouter-mistral-7b-free',
    provider: 'openrouter',
    model: 'mistralai/mistral-7b-instruct:free',
    reasoning: 'low',
    supportsStreaming: true,
    enabled: true,
    phase: 2,
    priority: 0.70,
  },

  // ── Cerebras (phase 2, needs CEREBRAS_API_KEY) ──────────────────────
  {
    id: 'cerebras-llama-70b',
    provider: 'cerebras',
    model: 'llama-3.3-70b',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    phase: 2,
    priority: 0.77,
  },
  {
    id: 'cerebras-qwen-32b',
    provider: 'cerebras',
    model: 'qwen-3-32b',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    phase: 2,
    priority: 0.74,
  },
  {
    id: 'cerebras-llama-8b',
    provider: 'cerebras',
    model: 'llama3.1-8b',
    reasoning: 'low',
    supportsStreaming: true,
    enabled: true,
    phase: 2,
    priority: 0.72,
  },

  // ── CLI Bridge (internal) ───────────────────────────────────────────
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
  // Workers AI
  'workers_ai:@cf/meta/llama-3.3-70b-instruct-fp8-fast': { requestsPerDay: 200 },
  'workers_ai:@cf/deepseek-ai/deepseek-r1-distill-qwen-32b': { requestsPerDay: 200 },
  'workers_ai:@cf/qwen/qwen1.5-14b-chat-awq': { requestsPerDay: 300 },
  'workers_ai:@cf/meta/llama-3.1-8b-instruct': { requestsPerDay: 500 },
  'workers_ai:@cf/google/gemma-7b-it-lora': { requestsPerDay: 500 },
  'workers_ai:@cf/mistral/mistral-7b-instruct-v0.1': { requestsPerDay: 500 },
  'workers_ai:@cf/meta/llama-3.2-3b-instruct': { requestsPerDay: 800 },
  'workers_ai:@cf/meta/llama-3.2-1b-instruct': { requestsPerDay: 1000 },
  'workers_ai:@cf/microsoft/phi-2': { requestsPerDay: 800 },
  // Groq
  'groq:deepseek-r1-distill-llama-70b': { requestsPerDay: 200 },
  'groq:llama-3.3-70b-versatile': { requestsPerDay: 300 },
  'groq:qwen-qwq-32b': { requestsPerDay: 300 },
  'groq:gemma2-9b-it': { requestsPerDay: 1000 },
  'groq:llama-3.1-8b-instant': { requestsPerDay: 1500 },
  'groq:mixtral-8x7b-32768': { requestsPerDay: 500 },
  'groq:llama3-8b-8192': { requestsPerDay: 1500 },
  'groq:llama3-70b-8192': { requestsPerDay: 300 },
  // Gemini
  'gemini:gemini-1.5-pro': { requestsPerDay: 50 },
  'gemini:gemini-2.0-flash': { requestsPerDay: 1000 },
  'gemini:gemini-1.5-flash': { requestsPerDay: 1500 },
  'gemini:gemini-2.0-flash-lite': { requestsPerDay: 1500 },
  'gemini:gemini-1.5-flash-8b': { requestsPerDay: 1500 },
  // OpenRouter
  'openrouter:meta-llama/llama-3.3-70b-instruct:free': { requestsPerDay: 50 },
  'openrouter:qwen/qwen-2.5-72b-instruct:free': { requestsPerDay: 50 },
  'openrouter:deepseek/deepseek-r1:free': { requestsPerDay: 50 },
  'openrouter:mistralai/mistral-7b-instruct:free': { requestsPerDay: 100 },
  // Cerebras
  'cerebras:llama-3.3-70b': { requestsPerDay: 300 },
  'cerebras:qwen-3-32b': { requestsPerDay: 500 },
  'cerebras:llama3.1-8b': { requestsPerDay: 1000 },
  // CLI Bridge
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
