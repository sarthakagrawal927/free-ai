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

    priority: 0.93,
  },
  {
    id: 'workers-ai-deepseek-r1-32b',
    provider: 'workers_ai',
    model: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,

    priority: 0.90,
  },
  {
    id: 'workers-ai-qwen-14b',
    provider: 'workers_ai',
    model: '@cf/qwen/qwen1.5-14b-chat-awq',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,

    priority: 0.85,
  },
  {
    id: 'workers-ai-llama-8b',
    provider: 'workers_ai',
    model: '@cf/meta/llama-3.1-8b-instruct',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,

    priority: 0.92,
  },
  {
    id: 'workers-ai-gemma-7b',
    provider: 'workers_ai',
    model: '@cf/google/gemma-7b-it-lora',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,

    priority: 0.82,
  },
  {
    id: 'workers-ai-mistral-7b',
    provider: 'workers_ai',
    model: '@cf/mistral/mistral-7b-instruct-v0.1',
    reasoning: 'low',
    supportsStreaming: true,
    enabled: true,

    priority: 0.88,
  },
  {
    id: 'workers-ai-llama-3b',
    provider: 'workers_ai',
    model: '@cf/meta/llama-3.2-3b-instruct',
    reasoning: 'low',
    supportsStreaming: true,
    enabled: true,

    priority: 0.83,
  },
  {
    id: 'workers-ai-llama-1b',
    provider: 'workers_ai',
    model: '@cf/meta/llama-3.2-1b-instruct',
    reasoning: 'low',
    supportsStreaming: true,
    enabled: true,

    priority: 0.78,
  },
  {
    id: 'workers-ai-phi-2',
    provider: 'workers_ai',
    model: '@cf/microsoft/phi-2',
    reasoning: 'low',
    supportsStreaming: true,
    enabled: true,

    priority: 0.75,
  },

  // ── Groq (free tier, rate-limited) ──────────────────────────────────
  {
    id: 'groq-llama-70b',
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,

    priority: 0.91,
  },
  {
    id: 'groq-gpt-oss-120b',
    provider: 'groq',
    model: 'openai/gpt-oss-120b',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,

    priority: 0.89,
  },
  {
    id: 'groq-gpt-oss-20b',
    provider: 'groq',
    model: 'openai/gpt-oss-20b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,

    priority: 0.87,
  },
  {
    id: 'groq-kimi-k2',
    provider: 'groq',
    model: 'moonshotai/kimi-k2-instruct',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,

    priority: 0.88,
  },
  {
    id: 'groq-qwen3-32b',
    provider: 'groq',
    model: 'qwen/qwen3-32b',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,

    priority: 0.86,
  },
  {
    id: 'groq-llama4-maverick',
    provider: 'groq',
    model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,

    priority: 0.85,
  },
  {
    id: 'groq-llama4-scout',
    provider: 'groq',
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,

    priority: 0.84,
  },
  {
    id: 'groq-llama-8b',
    provider: 'groq',
    model: 'llama-3.1-8b-instant',
    reasoning: 'low',
    supportsStreaming: true,
    enabled: true,

    priority: 0.91,
  },

  // ── Gemini (free tier, generous limits) ─────────────────────────────
  {
    id: 'gemini-2.5-pro',
    provider: 'gemini',
    model: 'gemini-2.5-pro',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,

    priority: 0.94,
  },
  {
    id: 'gemini-2.5-flash',
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,

    priority: 0.92,
  },
  {
    id: 'gemini-2.0-flash',
    provider: 'gemini',
    model: 'gemini-2.0-flash',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,

    priority: 0.90,
  },
  {
    id: 'gemini-2.0-flash-lite',
    provider: 'gemini',
    model: 'gemini-2.0-flash-lite',
    reasoning: 'low',
    supportsStreaming: true,
    enabled: true,

    priority: 0.89,
  },
  {
    id: 'gemini-2.5-flash-lite',
    provider: 'gemini',
    model: 'gemini-2.5-flash-lite',
    reasoning: 'low',
    supportsStreaming: true,
    enabled: true,

    priority: 0.87,
  },

  // ── OpenRouter (needs OPENROUTER_API_KEY) ────────────────────────────
  {
    id: 'openrouter-hermes-405b-free',
    provider: 'openrouter',
    model: 'nousresearch/hermes-3-llama-3.1-405b:free',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,

    priority: 0.79,
  },
  {
    id: 'openrouter-llama-70b-free',
    provider: 'openrouter',
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,

    priority: 0.78,
  },
  {
    id: 'openrouter-gpt-oss-120b-free',
    provider: 'openrouter',
    model: 'openai/gpt-oss-120b:free',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,

    priority: 0.77,
  },
  {
    id: 'openrouter-qwen3-next-80b-free',
    provider: 'openrouter',
    model: 'qwen/qwen3-next-80b-a3b-instruct:free',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,

    priority: 0.76,
  },
  {
    id: 'openrouter-gemma3-27b-free',
    provider: 'openrouter',
    model: 'google/gemma-3-27b-it:free',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,

    priority: 0.75,
  },
  {
    id: 'openrouter-mistral-small-24b-free',
    provider: 'openrouter',
    model: 'mistralai/mistral-small-3.1-24b-instruct:free',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,

    priority: 0.74,
  },
  {
    id: 'openrouter-qwen3-coder-free',
    provider: 'openrouter',
    model: 'qwen/qwen3-coder:free',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,

    priority: 0.73,
  },
  {
    id: 'openrouter-stepfun-flash-free',
    provider: 'openrouter',
    model: 'stepfun/step-3.5-flash:free',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,

    priority: 0.72,
  },
  {
    id: 'openrouter-gemma3-12b-free',
    provider: 'openrouter',
    model: 'google/gemma-3-12b-it:free',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,

    priority: 0.71,
  },
  {
    id: 'openrouter-nvidia-nemotron-12b-free',
    provider: 'openrouter',
    model: 'nvidia/nemotron-nano-12b-v2-vl:free',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,

    priority: 0.70,
  },

  // ── Cerebras (needs CEREBRAS_API_KEY) ───────────────────────────────
  {
    id: 'cerebras-gpt-oss-120b',
    provider: 'cerebras',
    model: 'gpt-oss-120b',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,

    priority: 0.77,
  },
  {
    id: 'cerebras-llama-8b',
    provider: 'cerebras',
    model: 'llama3.1-8b',
    reasoning: 'low',
    supportsStreaming: true,
    enabled: true,

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
  'groq:llama-3.3-70b-versatile': { requestsPerDay: 300 },
  'groq:openai/gpt-oss-120b': { requestsPerDay: 200 },
  'groq:openai/gpt-oss-20b': { requestsPerDay: 500 },
  'groq:moonshotai/kimi-k2-instruct': { requestsPerDay: 300 },
  'groq:qwen/qwen3-32b': { requestsPerDay: 500 },
  'groq:meta-llama/llama-4-maverick-17b-128e-instruct': { requestsPerDay: 500 },
  'groq:meta-llama/llama-4-scout-17b-16e-instruct': { requestsPerDay: 500 },
  'groq:llama-3.1-8b-instant': { requestsPerDay: 1500 },
  // Gemini
  'gemini:gemini-2.5-pro': { requestsPerDay: 50 },
  'gemini:gemini-2.5-flash': { requestsPerDay: 500 },
  'gemini:gemini-2.0-flash': { requestsPerDay: 1000 },
  'gemini:gemini-2.0-flash-lite': { requestsPerDay: 1500 },
  'gemini:gemini-2.5-flash-lite': { requestsPerDay: 1500 },
  // OpenRouter (free models, rate-limited upstream)
  'openrouter:nousresearch/hermes-3-llama-3.1-405b:free': { requestsPerDay: 50 },
  'openrouter:meta-llama/llama-3.3-70b-instruct:free': { requestsPerDay: 50 },
  'openrouter:openai/gpt-oss-120b:free': { requestsPerDay: 50 },
  'openrouter:qwen/qwen3-next-80b-a3b-instruct:free': { requestsPerDay: 50 },
  'openrouter:google/gemma-3-27b-it:free': { requestsPerDay: 100 },
  'openrouter:mistralai/mistral-small-3.1-24b-instruct:free': { requestsPerDay: 100 },
  'openrouter:qwen/qwen3-coder:free': { requestsPerDay: 50 },
  'openrouter:stepfun/step-3.5-flash:free': { requestsPerDay: 100 },
  'openrouter:google/gemma-3-12b-it:free': { requestsPerDay: 100 },
  'openrouter:nvidia/nemotron-nano-12b-v2-vl:free': { requestsPerDay: 100 },
  // Cerebras
  'cerebras:gpt-oss-120b': { requestsPerDay: 300 },
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

  return base.filter((candidate) => {
    if (!candidate.enabled) {
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
