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
    capabilities: { toolCalling: false, jsonMode: false, vision: false, contextWindow: 131072, maxOutputTokens: 4096 },
  },
  {
    id: 'workers-ai-deepseek-r1-32b',
    provider: 'workers_ai',
    model: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    priority: 0.90,
    capabilities: { toolCalling: false, jsonMode: false, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'workers-ai-qwen-14b',
    provider: 'workers_ai',
    model: '@cf/qwen/qwen1.5-14b-chat-awq',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.85,
    capabilities: { toolCalling: false, jsonMode: false, vision: false, contextWindow: 8192, maxOutputTokens: 2048 },
  },
  {
    id: 'workers-ai-llama-8b',
    provider: 'workers_ai',
    model: '@cf/meta/llama-3.1-8b-instruct',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.92,
    capabilities: { toolCalling: false, jsonMode: false, vision: false, contextWindow: 131072, maxOutputTokens: 4096 },
  },
  {
    id: 'workers-ai-gemma-7b',
    provider: 'workers_ai',
    model: '@cf/google/gemma-7b-it-lora',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.82,
    capabilities: { toolCalling: false, jsonMode: false, vision: false, contextWindow: 8192, maxOutputTokens: 2048 },
  },
  {
    id: 'workers-ai-mistral-7b',
    provider: 'workers_ai',
    model: '@cf/mistral/mistral-7b-instruct-v0.1',
    reasoning: 'low',
    supportsStreaming: true,
    enabled: true,
    priority: 0.88,
    capabilities: { toolCalling: false, jsonMode: false, vision: false, contextWindow: 8192, maxOutputTokens: 2048 },
  },
  {
    id: 'workers-ai-llama-3b',
    provider: 'workers_ai',
    model: '@cf/meta/llama-3.2-3b-instruct',
    reasoning: 'low',
    supportsStreaming: true,
    enabled: true,
    priority: 0.83,
    capabilities: { toolCalling: false, jsonMode: false, vision: false, contextWindow: 131072, maxOutputTokens: 4096 },
  },
  {
    id: 'workers-ai-llama-1b',
    provider: 'workers_ai',
    model: '@cf/meta/llama-3.2-1b-instruct',
    reasoning: 'low',
    supportsStreaming: true,
    enabled: true,
    priority: 0.78,
    capabilities: { toolCalling: false, jsonMode: false, vision: false, contextWindow: 131072, maxOutputTokens: 4096 },
  },
  {
    id: 'workers-ai-phi-2',
    provider: 'workers_ai',
    model: '@cf/microsoft/phi-2',
    reasoning: 'low',
    supportsStreaming: true,
    enabled: true,
    priority: 0.75,
    capabilities: { toolCalling: false, jsonMode: false, vision: false, contextWindow: 2048, maxOutputTokens: 1024 },
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
    capabilities: { toolCalling: true, jsonMode: true, vision: false, contextWindow: 131072, maxOutputTokens: 32768 },
  },
  {
    id: 'groq-gpt-oss-120b',
    provider: 'groq',
    model: 'openai/gpt-oss-120b',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    priority: 0.89,
    capabilities: { toolCalling: true, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 8192 },
  },
  {
    id: 'groq-gpt-oss-20b',
    provider: 'groq',
    model: 'openai/gpt-oss-20b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.87,
    capabilities: { toolCalling: true, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 8192 },
  },
  },
  {
    id: 'groq-qwen3-32b',
    provider: 'groq',
    model: 'qwen/qwen3-32b',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    priority: 0.86,
    capabilities: { toolCalling: true, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 8192 },
  },
  },
  {
    id: 'groq-llama4-scout',
    provider: 'groq',
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.84,
    capabilities: { toolCalling: true, jsonMode: true, vision: true, contextWindow: 131072, maxOutputTokens: 8192 },
  },
  {
    id: 'groq-llama-8b',
    provider: 'groq',
    model: 'llama-3.1-8b-instant',
    reasoning: 'low',
    supportsStreaming: true,
    enabled: true,
    priority: 0.91,
    capabilities: { toolCalling: true, jsonMode: true, vision: false, contextWindow: 131072, maxOutputTokens: 8192 },
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
    capabilities: { toolCalling: true, jsonMode: true, vision: true, contextWindow: 1048576, maxOutputTokens: 65536 },
  },
  {
    id: 'gemini-2.5-flash',
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    priority: 0.92,
    capabilities: { toolCalling: true, jsonMode: true, vision: true, contextWindow: 1048576, maxOutputTokens: 65536 },
  },
  {
    id: 'gemini-2.0-flash',
    provider: 'gemini',
    model: 'gemini-2.0-flash',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.90,
    capabilities: { toolCalling: true, jsonMode: true, vision: true, contextWindow: 1048576, maxOutputTokens: 8192 },
  },
  {
    id: 'gemini-2.0-flash-lite',
    provider: 'gemini',
    model: 'gemini-2.0-flash-lite',
    reasoning: 'low',
    supportsStreaming: true,
    enabled: true,
    priority: 0.89,
    capabilities: { toolCalling: true, jsonMode: true, vision: true, contextWindow: 1048576, maxOutputTokens: 8192 },
  },
  {
    id: 'gemini-2.5-flash-lite',
    provider: 'gemini',
    model: 'gemini-2.5-flash-lite',
    reasoning: 'low',
    supportsStreaming: true,
    enabled: true,
    priority: 0.87,
    capabilities: { toolCalling: true, jsonMode: true, vision: true, contextWindow: 1048576, maxOutputTokens: 8192 },
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
    capabilities: { toolCalling: true, jsonMode: true, vision: false, contextWindow: 131072, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-llama-70b-free',
    provider: 'openrouter',
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    priority: 0.78,
    capabilities: { toolCalling: true, jsonMode: true, vision: false, contextWindow: 131072, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-gpt-oss-120b-free',
    provider: 'openrouter',
    model: 'openai/gpt-oss-120b:free',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    priority: 0.77,
    capabilities: { toolCalling: true, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 8192 },
  },
  {
    id: 'openrouter-qwen3-next-80b-free',
    provider: 'openrouter',
    model: 'qwen/qwen3-next-80b-a3b-instruct:free',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    priority: 0.76,
    capabilities: { toolCalling: true, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 8192 },
  },
  {
    id: 'openrouter-gemma3-27b-free',
    provider: 'openrouter',
    model: 'google/gemma-3-27b-it:free',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.75,
    capabilities: { toolCalling: false, jsonMode: true, vision: true, contextWindow: 131072, maxOutputTokens: 8192 },
  },
  },
  {
    id: 'openrouter-qwen3-coder-free',
    provider: 'openrouter',
    model: 'qwen/qwen3-coder:free',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    priority: 0.73,
    capabilities: { toolCalling: true, jsonMode: true, vision: false, contextWindow: 131072, maxOutputTokens: 8192 },
  },
  },
  {
    id: 'openrouter-gemma3-12b-free',
    provider: 'openrouter',
    model: 'google/gemma-3-12b-it:free',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.71,
    capabilities: { toolCalling: false, jsonMode: true, vision: true, contextWindow: 131072, maxOutputTokens: 8192 },
  },
  {
    id: 'openrouter-nvidia-nemotron-12b-free',
    provider: 'openrouter',
    model: 'nvidia/nemotron-nano-12b-v2-vl:free',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.70,
    capabilities: { toolCalling: false, jsonMode: true, vision: true, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  },
  },
  {
    id: 'openrouter-glm-4.5-air-free',
    provider: 'openrouter',
    model: 'z-ai/glm-4.5-air:free',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    priority: 0.75,
    capabilities: { toolCalling: true, jsonMode: true, vision: false, contextWindow: 131072, maxOutputTokens: 8192 },
  },
  },
  },
  },
  },
  },
  {
    id: 'openrouter-llama-3.2-3b-free',
    provider: 'openrouter',
    model: 'meta-llama/llama-3.2-3b-instruct:free',
    reasoning: 'low',
    supportsStreaming: true,
    enabled: true,
    priority: 0.68,
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 131072, maxOutputTokens: 4096 },
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
    capabilities: { toolCalling: true, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 8192 },
  },
  {
    id: 'cerebras-llama-8b',
    provider: 'cerebras',
    model: 'llama3.1-8b',
    reasoning: 'low',
    supportsStreaming: true,
    enabled: true,
    priority: 0.72,
    capabilities: { toolCalling: true, jsonMode: true, vision: false, contextWindow: 131072, maxOutputTokens: 8192 },
  },

  // ── SambaNova (free tier, needs SAMBANOVA_API_KEY) ─────────────────
  {
    id: 'sambanova-llama-70b',
    provider: 'sambanova',
    model: 'Meta-Llama-3.3-70B-Instruct',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    priority: 0.76,
    capabilities: { toolCalling: true, jsonMode: true, vision: false, contextWindow: 131072, maxOutputTokens: 8192 },
  },
  {
    id: 'sambanova-deepseek-v3',
    provider: 'sambanova',
    model: 'DeepSeek-V3-0324',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    priority: 0.75,
    capabilities: { toolCalling: true, jsonMode: true, vision: false, contextWindow: 131072, maxOutputTokens: 8192 },
  },
  {
    id: 'sambanova-qwen3-32b',
    provider: 'sambanova',
    model: 'Qwen3-32B',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    priority: 0.74,
    capabilities: { toolCalling: true, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 8192 },
  },

  // ── NVIDIA NIM (free tier, needs NVIDIA_API_KEY) ───────────────────
  {
    id: 'nvidia-llama-70b',
    provider: 'nvidia',
    model: 'meta/llama-3.3-70b-instruct',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    priority: 0.73,
    capabilities: { toolCalling: true, jsonMode: true, vision: false, contextWindow: 131072, maxOutputTokens: 8192 },
  },
  {
    id: 'nvidia-deepseek-r1',
    provider: 'nvidia',
    model: 'deepseek-ai/deepseek-r1',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    priority: 0.72,
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 131072, maxOutputTokens: 8192 },
  },
  {
    id: 'nvidia-qwen-32b',
    provider: 'nvidia',
    model: 'qwen/qwen3-32b',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    priority: 0.71,
    capabilities: { toolCalling: true, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 8192 },
  },
  {
    id: 'nvidia-nemotron-super-49b',
    provider: 'nvidia',
    model: 'nvidia/llama-3.3-nemotron-super-49b-v1',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    priority: 0.74,
    capabilities: { toolCalling: true, jsonMode: true, vision: false, contextWindow: 131072, maxOutputTokens: 8192 },
  },
  {
    id: 'nvidia-nemotron-70b',
    provider: 'nvidia',
    model: 'nvidia/llama-3.1-nemotron-70b-instruct',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    priority: 0.73,
    capabilities: { toolCalling: true, jsonMode: true, vision: false, contextWindow: 131072, maxOutputTokens: 8192 },
  },
  {
    id: 'nvidia-llama4-maverick',
    provider: 'nvidia',
    model: 'meta/llama-4-maverick-17b-128e-instruct',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.72,
    capabilities: { toolCalling: true, jsonMode: true, vision: true, contextWindow: 131072, maxOutputTokens: 8192 },
  },
  {
    id: 'nvidia-llama4-scout',
    provider: 'nvidia',
    model: 'meta/llama-4-scout-17b-16e-instruct',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.70,
    capabilities: { toolCalling: true, jsonMode: true, vision: true, contextWindow: 131072, maxOutputTokens: 8192 },
  },
  {
    id: 'nvidia-deepseek-v3',
    provider: 'nvidia',
    model: 'deepseek-ai/deepseek-v3',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    priority: 0.71,
    capabilities: { toolCalling: true, jsonMode: true, vision: false, contextWindow: 131072, maxOutputTokens: 8192 },
  },
  {
    id: 'nvidia-deepseek-r1-distill-70b',
    provider: 'nvidia',
    model: 'deepseek-ai/deepseek-r1-distill-llama-70b',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    priority: 0.69,
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 131072, maxOutputTokens: 8192 },
  },
  {
    id: 'nvidia-mixtral-8x22b',
    provider: 'nvidia',
    model: 'mistralai/mixtral-8x22b-instruct-v0.1',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.67,
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 65536, maxOutputTokens: 4096 },
  },
  {
    id: 'nvidia-qwen-coder-32b',
    provider: 'nvidia',
    model: 'qwen/qwen2.5-coder-32b-instruct',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    priority: 0.68,
    capabilities: { toolCalling: true, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 8192 },
  },
  {
    id: 'nvidia-gemma3-27b',
    provider: 'nvidia',
    model: 'google/gemma-3-27b-it',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.66,
    capabilities: { toolCalling: false, jsonMode: true, vision: true, contextWindow: 131072, maxOutputTokens: 8192 },
  },
  {
    id: 'nvidia-phi-4',
    provider: 'nvidia',
    model: 'microsoft/phi-4',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.65,
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 16384, maxOutputTokens: 4096 },
  },

  // ── GitHub Models (needs GITHUB_TOKEN, free tier) ───────────────────
  {
    id: 'gh-gpt-5',
    provider: 'github_models',
    model: 'openai/gpt-5',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    priority: 0.95,
    capabilities: { toolCalling: true, jsonMode: true, vision: true, contextWindow: 272000, maxOutputTokens: 16384 },
  },
  {
    id: 'gh-gpt-5-mini',
    provider: 'github_models',
    model: 'openai/gpt-5-mini',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    priority: 0.93,
    capabilities: { toolCalling: true, jsonMode: true, vision: true, contextWindow: 272000, maxOutputTokens: 16384 },
  },
  {
    id: 'gh-gpt-5-nano',
    provider: 'github_models',
    model: 'openai/gpt-5-nano',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.88,
    capabilities: { toolCalling: true, jsonMode: true, vision: true, contextWindow: 272000, maxOutputTokens: 16384 },
  },
  {
    id: 'gh-gpt-4.1',
    provider: 'github_models',
    model: 'openai/gpt-4.1',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    priority: 0.91,
    capabilities: { toolCalling: true, jsonMode: true, vision: true, contextWindow: 1047576, maxOutputTokens: 32768 },
  },
  {
    id: 'gh-gpt-4.1-mini',
    provider: 'github_models',
    model: 'openai/gpt-4.1-mini',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.89,
    capabilities: { toolCalling: true, jsonMode: true, vision: true, contextWindow: 1047576, maxOutputTokens: 32768 },
  },
  {
    id: 'gh-gpt-4o-mini',
    provider: 'github_models',
    model: 'openai/gpt-4o-mini',
    reasoning: 'low',
    supportsStreaming: true,
    enabled: true,
    priority: 0.86,
    capabilities: { toolCalling: true, jsonMode: true, vision: true, contextWindow: 128000, maxOutputTokens: 16384 },
  },
  {
    id: 'gh-o3',
    provider: 'github_models',
    model: 'openai/o3',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    priority: 0.94,
    capabilities: { toolCalling: true, jsonMode: true, vision: true, contextWindow: 200000, maxOutputTokens: 100000 },
  },
  {
    id: 'gh-o4-mini',
    provider: 'github_models',
    model: 'openai/o4-mini',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    priority: 0.90,
    capabilities: { toolCalling: true, jsonMode: true, vision: true, contextWindow: 200000, maxOutputTokens: 100000 },
  },
  {
    id: 'gh-deepseek-r1',
    provider: 'github_models',
    model: 'deepseek/deepseek-r1',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    priority: 0.87,
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 163840, maxOutputTokens: 8192 },
  },
  {
    id: 'gh-deepseek-r1-0528',
    provider: 'github_models',
    model: 'deepseek/deepseek-r1-0528',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    priority: 0.86,
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 163840, maxOutputTokens: 8192 },
  },
  {
    id: 'gh-deepseek-v3',
    provider: 'github_models',
    model: 'deepseek/deepseek-v3-0324',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    priority: 0.85,
    capabilities: { toolCalling: true, jsonMode: true, vision: false, contextWindow: 131072, maxOutputTokens: 8192 },
  },
  {
    id: 'gh-llama-4-maverick',
    provider: 'github_models',
    model: 'meta/llama-4-maverick-17b-128e-instruct-fp8',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.82,
    capabilities: { toolCalling: true, jsonMode: true, vision: true, contextWindow: 131072, maxOutputTokens: 8192 },
  },
  {
    id: 'gh-llama-4-scout',
    provider: 'github_models',
    model: 'meta/llama-4-scout-17b-16e-instruct',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.81,
    capabilities: { toolCalling: true, jsonMode: true, vision: true, contextWindow: 131072, maxOutputTokens: 8192 },
  },
  {
    id: 'gh-llama-3.3-70b',
    provider: 'github_models',
    model: 'meta/llama-3.3-70b-instruct',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    priority: 0.83,
    capabilities: { toolCalling: true, jsonMode: true, vision: false, contextWindow: 131072, maxOutputTokens: 8192 },
  },
  {
    id: 'gh-grok-3',
    provider: 'github_models',
    model: 'xai/grok-3',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    priority: 0.84,
    capabilities: { toolCalling: true, jsonMode: true, vision: false, contextWindow: 131072, maxOutputTokens: 8192 },
  },
  {
    id: 'gh-grok-3-mini',
    provider: 'github_models',
    model: 'xai/grok-3-mini',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.80,
    capabilities: { toolCalling: true, jsonMode: true, vision: false, contextWindow: 131072, maxOutputTokens: 8192 },
  },
  {
    id: 'gh-codestral',
    provider: 'github_models',
    model: 'mistral-ai/codestral-2501',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    priority: 0.82,
    capabilities: { toolCalling: true, jsonMode: true, vision: false, contextWindow: 262144, maxOutputTokens: 8192 },
  },
  {
    id: 'gh-mistral-medium',
    provider: 'github_models',
    model: 'mistral-ai/mistral-medium-2505',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    priority: 0.79,
    capabilities: { toolCalling: true, jsonMode: true, vision: false, contextWindow: 131072, maxOutputTokens: 8192 },
  },
  {
    id: 'gh-command-a',
    provider: 'github_models',
    model: 'cohere/cohere-command-a',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    priority: 0.78,
    capabilities: { toolCalling: true, jsonMode: true, vision: false, contextWindow: 131072, maxOutputTokens: 8192 },
  },
  {
    id: 'gh-command-r-plus',
    provider: 'github_models',
    model: 'cohere/cohere-command-r-plus-08-2024',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    priority: 0.77,
    capabilities: { toolCalling: true, jsonMode: true, vision: false, contextWindow: 131072, maxOutputTokens: 4096 },
  },
  {
    id: 'gh-phi-4',
    provider: 'github_models',
    model: 'microsoft/phi-4',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.72,
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 16384, maxOutputTokens: 4096 },
  },
  {
    id: 'gh-phi-4-reasoning',
    provider: 'github_models',
    model: 'microsoft/phi-4-reasoning',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    priority: 0.73,
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 8192 },
  },
  {
    id: 'gh-mai-ds-r1',
    provider: 'github_models',
    model: 'microsoft/mai-ds-r1',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    priority: 0.74,
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 163840, maxOutputTokens: 8192 },
  },

  // ── Pollinations (no key required) ──────────────────────────────────
  {
    id: 'pollinations-openai-large',
    provider: 'pollinations',
    model: 'openai-large',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    priority: 0.70,
    capabilities: { toolCalling: true, jsonMode: true, vision: true, contextWindow: 131072, maxOutputTokens: 16384 },
  },
  {
    id: 'pollinations-openai',
    provider: 'pollinations',
    model: 'openai',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.68,
    capabilities: { toolCalling: true, jsonMode: true, vision: true, contextWindow: 128000, maxOutputTokens: 8192 },
  },
  {
    id: 'pollinations-deepseek-reasoning',
    provider: 'pollinations',
    model: 'deepseek-reasoning',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    priority: 0.67,
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 131072, maxOutputTokens: 8192 },
  },
  {
    id: 'pollinations-qwen-coder',
    provider: 'pollinations',
    model: 'qwen-coder',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    priority: 0.66,
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 8192 },
  },
  {
    id: 'pollinations-mistral',
    provider: 'pollinations',
    model: 'mistral',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.65,
    capabilities: { toolCalling: true, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 8192 },
  },
  {
    id: 'pollinations-llama-scout',
    provider: 'pollinations',
    model: 'llamascout',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.64,
    capabilities: { toolCalling: false, jsonMode: true, vision: true, contextWindow: 131072, maxOutputTokens: 8192 },
  },

  // ── Cohere (trial key, 1000 req/mo) ─────────────────────────────────
  {
    id: 'cohere-command-a',
    provider: 'cohere',
    model: 'command-a-03-2025',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    priority: 0.82,
    capabilities: { toolCalling: true, jsonMode: true, vision: false, contextWindow: 256000, maxOutputTokens: 8192 },
  },
  {
    id: 'cohere-command-r-plus',
    provider: 'cohere',
    model: 'command-r-plus-08-2024',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    priority: 0.78,
    capabilities: { toolCalling: true, jsonMode: true, vision: false, contextWindow: 128000, maxOutputTokens: 4096 },
  },
  {
    id: 'cohere-command-r',
    provider: 'cohere',
    model: 'command-r-08-2024',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.75,
    capabilities: { toolCalling: true, jsonMode: true, vision: false, contextWindow: 128000, maxOutputTokens: 4096 },
  },
  {
    id: 'cohere-command-r7b',
    provider: 'cohere',
    model: 'command-r7b-12-2024',
    reasoning: 'low',
    supportsStreaming: true,
    enabled: true,
    priority: 0.70,
    capabilities: { toolCalling: true, jsonMode: true, vision: false, contextWindow: 128000, maxOutputTokens: 4096 },
  },

  // ── Mistral La Plateforme (Experiment tier, 1 RPS, 500k tok/min) ────
  {
    id: 'mistral-large',
    provider: 'mistral',
    model: 'mistral-large-latest',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    priority: 0.85,
    capabilities: { toolCalling: true, jsonMode: true, vision: false, contextWindow: 131072, maxOutputTokens: 8192 },
  },
  {
    id: 'mistral-medium',
    provider: 'mistral',
    model: 'mistral-medium-latest',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    priority: 0.82,
    capabilities: { toolCalling: true, jsonMode: true, vision: false, contextWindow: 131072, maxOutputTokens: 8192 },
  },
  {
    id: 'mistral-small',
    provider: 'mistral',
    model: 'mistral-small-latest',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.78,
    capabilities: { toolCalling: true, jsonMode: true, vision: true, contextWindow: 131072, maxOutputTokens: 8192 },
  },
  {
    id: 'mistral-codestral',
    provider: 'mistral',
    model: 'codestral-latest',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    priority: 0.80,
    capabilities: { toolCalling: true, jsonMode: true, vision: false, contextWindow: 262144, maxOutputTokens: 8192 },
  },
  {
    id: 'mistral-ministral-8b',
    provider: 'mistral',
    model: 'ministral-8b-latest',
    reasoning: 'low',
    supportsStreaming: true,
    enabled: true,
    priority: 0.72,
    capabilities: { toolCalling: true, jsonMode: true, vision: false, contextWindow: 131072, maxOutputTokens: 8192 },
  },
  {
    id: 'mistral-ministral-3b',
    provider: 'mistral',
    model: 'ministral-3b-latest',
    reasoning: 'low',
    supportsStreaming: true,
    enabled: true,
    priority: 0.70,
    capabilities: { toolCalling: true, jsonMode: true, vision: false, contextWindow: 131072, maxOutputTokens: 8192 },
  },
  {
    id: 'mistral-pixtral',
    provider: 'mistral',
    model: 'pixtral-large-latest',
    reasoning: 'high',
    supportsStreaming: true,
    enabled: true,
    priority: 0.76,
    capabilities: { toolCalling: true, jsonMode: true, vision: true, contextWindow: 131072, maxOutputTokens: 8192 },
  },

  // ── Auto-added by weekly model check (review priority + capabilities) ──
  {
    id: 'groq-meta-llama-llama-prompt-guard-2-86m',
    provider: 'groq',
    model: 'meta-llama/llama-prompt-guard-2-86m',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'groq-openai-gpt-oss-safeguard-20b',
    provider: 'groq',
    model: 'openai/gpt-oss-safeguard-20b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'groq-meta-llama-llama-prompt-guard-2-22m',
    provider: 'groq',
    model: 'meta-llama/llama-prompt-guard-2-22m',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'groq-allam-2-7b',
    provider: 'groq',
    model: 'allam-2-7b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'groq-groq-compound-mini',
    provider: 'groq',
    model: 'groq/compound-mini',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'groq-canopylabs-orpheus-v1-english',
    provider: 'groq',
    model: 'canopylabs/orpheus-v1-english',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'groq-groq-compound',
    provider: 'groq',
    model: 'groq/compound',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'groq-canopylabs-orpheus-arabic-saudi',
    provider: 'groq',
    model: 'canopylabs/orpheus-arabic-saudi',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-tencent-hy3-preview-free',
    provider: 'openrouter',
    model: 'tencent/hy3-preview:free',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-xiaomi-mimo-v2-5-pro',
    provider: 'openrouter',
    model: 'xiaomi/mimo-v2.5-pro',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-xiaomi-mimo-v2-5',
    provider: 'openrouter',
    model: 'xiaomi/mimo-v2.5',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-5-4-image-2',
    provider: 'openrouter',
    model: 'openai/gpt-5.4-image-2',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-inclusionai-ling-2-6-flash-free',
    provider: 'openrouter',
    model: 'inclusionai/ling-2.6-flash:free',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter--anthropic-claude-opus-latest',
    provider: 'openrouter',
    model: '~anthropic/claude-opus-latest',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openrouter-pareto-code',
    provider: 'openrouter',
    model: 'openrouter/pareto-code',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-baidu-qianfan-ocr-fast-free',
    provider: 'openrouter',
    model: 'baidu/qianfan-ocr-fast:free',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-moonshotai-kimi-k2-6',
    provider: 'openrouter',
    model: 'moonshotai/kimi-k2.6',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-anthropic-claude-opus-4-7',
    provider: 'openrouter',
    model: 'anthropic/claude-opus-4.7',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-anthropic-claude-opus-4-6-fast',
    provider: 'openrouter',
    model: 'anthropic/claude-opus-4.6-fast',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-z-ai-glm-5-1',
    provider: 'openrouter',
    model: 'z-ai/glm-5.1',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-google-gemma-4-26b-a4b-it-free',
    provider: 'openrouter',
    model: 'google/gemma-4-26b-a4b-it:free',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-google-gemma-4-26b-a4b-it',
    provider: 'openrouter',
    model: 'google/gemma-4-26b-a4b-it',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-google-gemma-4-31b-it-free',
    provider: 'openrouter',
    model: 'google/gemma-4-31b-it:free',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-google-gemma-4-31b-it',
    provider: 'openrouter',
    model: 'google/gemma-4-31b-it',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-qwen-qwen3-6-plus',
    provider: 'openrouter',
    model: 'qwen/qwen3.6-plus',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-z-ai-glm-5v-turbo',
    provider: 'openrouter',
    model: 'z-ai/glm-5v-turbo',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-arcee-ai-trinity-large-thinking',
    provider: 'openrouter',
    model: 'arcee-ai/trinity-large-thinking',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-x-ai-grok-4-20-multi-agent',
    provider: 'openrouter',
    model: 'x-ai/grok-4.20-multi-agent',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-x-ai-grok-4-20',
    provider: 'openrouter',
    model: 'x-ai/grok-4.20',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-google-lyria-3-pro-preview',
    provider: 'openrouter',
    model: 'google/lyria-3-pro-preview',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-google-lyria-3-clip-preview',
    provider: 'openrouter',
    model: 'google/lyria-3-clip-preview',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-kwaipilot-kat-coder-pro-v2',
    provider: 'openrouter',
    model: 'kwaipilot/kat-coder-pro-v2',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-rekaai-reka-edge',
    provider: 'openrouter',
    model: 'rekaai/reka-edge',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-xiaomi-mimo-v2-omni',
    provider: 'openrouter',
    model: 'xiaomi/mimo-v2-omni',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-xiaomi-mimo-v2-pro',
    provider: 'openrouter',
    model: 'xiaomi/mimo-v2-pro',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-minimax-minimax-m2-7',
    provider: 'openrouter',
    model: 'minimax/minimax-m2.7',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-5-4-nano',
    provider: 'openrouter',
    model: 'openai/gpt-5.4-nano',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-5-4-mini',
    provider: 'openrouter',
    model: 'openai/gpt-5.4-mini',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-mistralai-mistral-small-2603',
    provider: 'openrouter',
    model: 'mistralai/mistral-small-2603',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-z-ai-glm-5-turbo',
    provider: 'openrouter',
    model: 'z-ai/glm-5-turbo',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-nvidia-nemotron-3-super-120b-a12b-free',
    provider: 'openrouter',
    model: 'nvidia/nemotron-3-super-120b-a12b:free',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-nvidia-nemotron-3-super-120b-a12b',
    provider: 'openrouter',
    model: 'nvidia/nemotron-3-super-120b-a12b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-bytedance-seed-seed-2-0-lite',
    provider: 'openrouter',
    model: 'bytedance-seed/seed-2.0-lite',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-qwen-qwen3-5-9b',
    provider: 'openrouter',
    model: 'qwen/qwen3.5-9b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-5-4-pro',
    provider: 'openrouter',
    model: 'openai/gpt-5.4-pro',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-5-4',
    provider: 'openrouter',
    model: 'openai/gpt-5.4',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-inception-mercury-2',
    provider: 'openrouter',
    model: 'inception/mercury-2',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-5-3-chat',
    provider: 'openrouter',
    model: 'openai/gpt-5.3-chat',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-google-gemini-3-1-flash-lite-preview',
    provider: 'openrouter',
    model: 'google/gemini-3.1-flash-lite-preview',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-bytedance-seed-seed-2-0-mini',
    provider: 'openrouter',
    model: 'bytedance-seed/seed-2.0-mini',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-google-gemini-3-1-flash-image-preview',
    provider: 'openrouter',
    model: 'google/gemini-3.1-flash-image-preview',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-qwen-qwen3-5-35b-a3b',
    provider: 'openrouter',
    model: 'qwen/qwen3.5-35b-a3b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-qwen-qwen3-5-27b',
    provider: 'openrouter',
    model: 'qwen/qwen3.5-27b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-qwen-qwen3-5-122b-a10b',
    provider: 'openrouter',
    model: 'qwen/qwen3.5-122b-a10b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-qwen-qwen3-5-flash-02-23',
    provider: 'openrouter',
    model: 'qwen/qwen3.5-flash-02-23',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-liquid-lfm-2-24b-a2b',
    provider: 'openrouter',
    model: 'liquid/lfm-2-24b-a2b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-google-gemini-3-1-pro-preview-customtools',
    provider: 'openrouter',
    model: 'google/gemini-3.1-pro-preview-customtools',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-5-3-codex',
    provider: 'openrouter',
    model: 'openai/gpt-5.3-codex',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-aion-labs-aion-2-0',
    provider: 'openrouter',
    model: 'aion-labs/aion-2.0',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-google-gemini-3-1-pro-preview',
    provider: 'openrouter',
    model: 'google/gemini-3.1-pro-preview',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-anthropic-claude-sonnet-4-6',
    provider: 'openrouter',
    model: 'anthropic/claude-sonnet-4.6',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-qwen-qwen3-5-plus-02-15',
    provider: 'openrouter',
    model: 'qwen/qwen3.5-plus-02-15',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-qwen-qwen3-5-397b-a17b',
    provider: 'openrouter',
    model: 'qwen/qwen3.5-397b-a17b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-minimax-minimax-m2-5-free',
    provider: 'openrouter',
    model: 'minimax/minimax-m2.5:free',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-minimax-minimax-m2-5',
    provider: 'openrouter',
    model: 'minimax/minimax-m2.5',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-z-ai-glm-5',
    provider: 'openrouter',
    model: 'z-ai/glm-5',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-qwen-qwen3-max-thinking',
    provider: 'openrouter',
    model: 'qwen/qwen3-max-thinking',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-anthropic-claude-opus-4-6',
    provider: 'openrouter',
    model: 'anthropic/claude-opus-4.6',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-qwen-qwen3-coder-next',
    provider: 'openrouter',
    model: 'qwen/qwen3-coder-next',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openrouter-free',
    provider: 'openrouter',
    model: 'openrouter/free',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-stepfun-step-3-5-flash',
    provider: 'openrouter',
    model: 'stepfun/step-3.5-flash',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-arcee-ai-trinity-large-preview',
    provider: 'openrouter',
    model: 'arcee-ai/trinity-large-preview',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-moonshotai-kimi-k2-5',
    provider: 'openrouter',
    model: 'moonshotai/kimi-k2.5',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-upstage-solar-pro-3',
    provider: 'openrouter',
    model: 'upstage/solar-pro-3',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-minimax-minimax-m2-her',
    provider: 'openrouter',
    model: 'minimax/minimax-m2-her',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-writer-palmyra-x5',
    provider: 'openrouter',
    model: 'writer/palmyra-x5',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-liquid-lfm-2-5-1-2b-thinking-free',
    provider: 'openrouter',
    model: 'liquid/lfm-2.5-1.2b-thinking:free',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-liquid-lfm-2-5-1-2b-instruct-free',
    provider: 'openrouter',
    model: 'liquid/lfm-2.5-1.2b-instruct:free',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-audio',
    provider: 'openrouter',
    model: 'openai/gpt-audio',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-audio-mini',
    provider: 'openrouter',
    model: 'openai/gpt-audio-mini',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-z-ai-glm-4-7-flash',
    provider: 'openrouter',
    model: 'z-ai/glm-4.7-flash',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-5-2-codex',
    provider: 'openrouter',
    model: 'openai/gpt-5.2-codex',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-allenai-olmo-3-1-32b-instruct',
    provider: 'openrouter',
    model: 'allenai/olmo-3.1-32b-instruct',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-bytedance-seed-seed-1-6-flash',
    provider: 'openrouter',
    model: 'bytedance-seed/seed-1.6-flash',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-bytedance-seed-seed-1-6',
    provider: 'openrouter',
    model: 'bytedance-seed/seed-1.6',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-minimax-minimax-m2-1',
    provider: 'openrouter',
    model: 'minimax/minimax-m2.1',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-z-ai-glm-4-7',
    provider: 'openrouter',
    model: 'z-ai/glm-4.7',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-google-gemini-3-flash-preview',
    provider: 'openrouter',
    model: 'google/gemini-3-flash-preview',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-mistralai-mistral-small-creative',
    provider: 'openrouter',
    model: 'mistralai/mistral-small-creative',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-xiaomi-mimo-v2-flash',
    provider: 'openrouter',
    model: 'xiaomi/mimo-v2-flash',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-nvidia-nemotron-3-nano-30b-a3b-free',
    provider: 'openrouter',
    model: 'nvidia/nemotron-3-nano-30b-a3b:free',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-nvidia-nemotron-3-nano-30b-a3b',
    provider: 'openrouter',
    model: 'nvidia/nemotron-3-nano-30b-a3b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-5-2-chat',
    provider: 'openrouter',
    model: 'openai/gpt-5.2-chat',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-5-2-pro',
    provider: 'openrouter',
    model: 'openai/gpt-5.2-pro',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-5-2',
    provider: 'openrouter',
    model: 'openai/gpt-5.2',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-mistralai-devstral-2512',
    provider: 'openrouter',
    model: 'mistralai/devstral-2512',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-relace-relace-search',
    provider: 'openrouter',
    model: 'relace/relace-search',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-z-ai-glm-4-6v',
    provider: 'openrouter',
    model: 'z-ai/glm-4.6v',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-nex-agi-deepseek-v3-1-nex-n1',
    provider: 'openrouter',
    model: 'nex-agi/deepseek-v3.1-nex-n1',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-essentialai-rnj-1-instruct',
    provider: 'openrouter',
    model: 'essentialai/rnj-1-instruct',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openrouter-bodybuilder',
    provider: 'openrouter',
    model: 'openrouter/bodybuilder',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-5-1-codex-max',
    provider: 'openrouter',
    model: 'openai/gpt-5.1-codex-max',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-amazon-nova-2-lite-v1',
    provider: 'openrouter',
    model: 'amazon/nova-2-lite-v1',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-mistralai-ministral-14b-2512',
    provider: 'openrouter',
    model: 'mistralai/ministral-14b-2512',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-mistralai-ministral-8b-2512',
    provider: 'openrouter',
    model: 'mistralai/ministral-8b-2512',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-mistralai-ministral-3b-2512',
    provider: 'openrouter',
    model: 'mistralai/ministral-3b-2512',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-mistralai-mistral-large-2512',
    provider: 'openrouter',
    model: 'mistralai/mistral-large-2512',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-arcee-ai-trinity-mini',
    provider: 'openrouter',
    model: 'arcee-ai/trinity-mini',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-deepseek-deepseek-v3-2-speciale',
    provider: 'openrouter',
    model: 'deepseek/deepseek-v3.2-speciale',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-deepseek-deepseek-v3-2',
    provider: 'openrouter',
    model: 'deepseek/deepseek-v3.2',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-prime-intellect-intellect-3',
    provider: 'openrouter',
    model: 'prime-intellect/intellect-3',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-anthropic-claude-opus-4-5',
    provider: 'openrouter',
    model: 'anthropic/claude-opus-4.5',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-allenai-olmo-3-32b-think',
    provider: 'openrouter',
    model: 'allenai/olmo-3-32b-think',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-google-gemini-3-pro-image-preview',
    provider: 'openrouter',
    model: 'google/gemini-3-pro-image-preview',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-x-ai-grok-4-1-fast',
    provider: 'openrouter',
    model: 'x-ai/grok-4.1-fast',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-5-1',
    provider: 'openrouter',
    model: 'openai/gpt-5.1',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-5-1-chat',
    provider: 'openrouter',
    model: 'openai/gpt-5.1-chat',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-5-1-codex',
    provider: 'openrouter',
    model: 'openai/gpt-5.1-codex',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-5-1-codex-mini',
    provider: 'openrouter',
    model: 'openai/gpt-5.1-codex-mini',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-moonshotai-kimi-k2-thinking',
    provider: 'openrouter',
    model: 'moonshotai/kimi-k2-thinking',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-amazon-nova-premier-v1',
    provider: 'openrouter',
    model: 'amazon/nova-premier-v1',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-perplexity-sonar-pro-search',
    provider: 'openrouter',
    model: 'perplexity/sonar-pro-search',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-mistralai-voxtral-small-24b-2507',
    provider: 'openrouter',
    model: 'mistralai/voxtral-small-24b-2507',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-oss-safeguard-20b',
    provider: 'openrouter',
    model: 'openai/gpt-oss-safeguard-20b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-nvidia-nemotron-nano-12b-v2-vl',
    provider: 'openrouter',
    model: 'nvidia/nemotron-nano-12b-v2-vl',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-minimax-minimax-m2',
    provider: 'openrouter',
    model: 'minimax/minimax-m2',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-qwen-qwen3-vl-32b-instruct',
    provider: 'openrouter',
    model: 'qwen/qwen3-vl-32b-instruct',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-ibm-granite-granite-4-0-h-micro',
    provider: 'openrouter',
    model: 'ibm-granite/granite-4.0-h-micro',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-5-image-mini',
    provider: 'openrouter',
    model: 'openai/gpt-5-image-mini',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-anthropic-claude-haiku-4-5',
    provider: 'openrouter',
    model: 'anthropic/claude-haiku-4.5',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-qwen-qwen3-vl-8b-thinking',
    provider: 'openrouter',
    model: 'qwen/qwen3-vl-8b-thinking',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-qwen-qwen3-vl-8b-instruct',
    provider: 'openrouter',
    model: 'qwen/qwen3-vl-8b-instruct',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-5-image',
    provider: 'openrouter',
    model: 'openai/gpt-5-image',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-o3-deep-research',
    provider: 'openrouter',
    model: 'openai/o3-deep-research',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-o4-mini-deep-research',
    provider: 'openrouter',
    model: 'openai/o4-mini-deep-research',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-nvidia-llama-3-3-nemotron-super-49b-v1-5',
    provider: 'openrouter',
    model: 'nvidia/llama-3.3-nemotron-super-49b-v1.5',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-baidu-ernie-4-5-21b-a3b-thinking',
    provider: 'openrouter',
    model: 'baidu/ernie-4.5-21b-a3b-thinking',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-google-gemini-2-5-flash-image',
    provider: 'openrouter',
    model: 'google/gemini-2.5-flash-image',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-qwen-qwen3-vl-30b-a3b-thinking',
    provider: 'openrouter',
    model: 'qwen/qwen3-vl-30b-a3b-thinking',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-qwen-qwen3-vl-30b-a3b-instruct',
    provider: 'openrouter',
    model: 'qwen/qwen3-vl-30b-a3b-instruct',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-5-pro',
    provider: 'openrouter',
    model: 'openai/gpt-5-pro',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-z-ai-glm-4-6',
    provider: 'openrouter',
    model: 'z-ai/glm-4.6',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-anthropic-claude-sonnet-4-5',
    provider: 'openrouter',
    model: 'anthropic/claude-sonnet-4.5',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-deepseek-deepseek-v3-2-exp',
    provider: 'openrouter',
    model: 'deepseek/deepseek-v3.2-exp',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-thedrummer-cydonia-24b-v4-1',
    provider: 'openrouter',
    model: 'thedrummer/cydonia-24b-v4.1',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-relace-relace-apply-3',
    provider: 'openrouter',
    model: 'relace/relace-apply-3',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-google-gemini-2-5-flash-lite-preview-09-2025',
    provider: 'openrouter',
    model: 'google/gemini-2.5-flash-lite-preview-09-2025',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-qwen-qwen3-vl-235b-a22b-thinking',
    provider: 'openrouter',
    model: 'qwen/qwen3-vl-235b-a22b-thinking',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-qwen-qwen3-vl-235b-a22b-instruct',
    provider: 'openrouter',
    model: 'qwen/qwen3-vl-235b-a22b-instruct',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-qwen-qwen3-max',
    provider: 'openrouter',
    model: 'qwen/qwen3-max',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-qwen-qwen3-coder-plus',
    provider: 'openrouter',
    model: 'qwen/qwen3-coder-plus',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-5-codex',
    provider: 'openrouter',
    model: 'openai/gpt-5-codex',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-deepseek-deepseek-v3-1-terminus',
    provider: 'openrouter',
    model: 'deepseek/deepseek-v3.1-terminus',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-x-ai-grok-4-fast',
    provider: 'openrouter',
    model: 'x-ai/grok-4-fast',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-alibaba-tongyi-deepresearch-30b-a3b',
    provider: 'openrouter',
    model: 'alibaba/tongyi-deepresearch-30b-a3b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-qwen-qwen3-coder-flash',
    provider: 'openrouter',
    model: 'qwen/qwen3-coder-flash',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-qwen-qwen3-next-80b-a3b-thinking',
    provider: 'openrouter',
    model: 'qwen/qwen3-next-80b-a3b-thinking',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-qwen-qwen3-next-80b-a3b-instruct',
    provider: 'openrouter',
    model: 'qwen/qwen3-next-80b-a3b-instruct',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-qwen-qwen-plus-2025-07-28-thinking',
    provider: 'openrouter',
    model: 'qwen/qwen-plus-2025-07-28:thinking',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-qwen-qwen-plus-2025-07-28',
    provider: 'openrouter',
    model: 'qwen/qwen-plus-2025-07-28',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-nvidia-nemotron-nano-9b-v2-free',
    provider: 'openrouter',
    model: 'nvidia/nemotron-nano-9b-v2:free',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-nvidia-nemotron-nano-9b-v2',
    provider: 'openrouter',
    model: 'nvidia/nemotron-nano-9b-v2',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-moonshotai-kimi-k2-0905',
    provider: 'openrouter',
    model: 'moonshotai/kimi-k2-0905',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-qwen-qwen3-30b-a3b-thinking-2507',
    provider: 'openrouter',
    model: 'qwen/qwen3-30b-a3b-thinking-2507',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-x-ai-grok-code-fast-1',
    provider: 'openrouter',
    model: 'x-ai/grok-code-fast-1',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-nousresearch-hermes-4-70b',
    provider: 'openrouter',
    model: 'nousresearch/hermes-4-70b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-nousresearch-hermes-4-405b',
    provider: 'openrouter',
    model: 'nousresearch/hermes-4-405b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-deepseek-deepseek-chat-v3-1',
    provider: 'openrouter',
    model: 'deepseek/deepseek-chat-v3.1',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-4o-audio-preview',
    provider: 'openrouter',
    model: 'openai/gpt-4o-audio-preview',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-mistralai-mistral-medium-3-1',
    provider: 'openrouter',
    model: 'mistralai/mistral-medium-3.1',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-baidu-ernie-4-5-21b-a3b',
    provider: 'openrouter',
    model: 'baidu/ernie-4.5-21b-a3b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-baidu-ernie-4-5-vl-28b-a3b',
    provider: 'openrouter',
    model: 'baidu/ernie-4.5-vl-28b-a3b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-z-ai-glm-4-5v',
    provider: 'openrouter',
    model: 'z-ai/glm-4.5v',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-ai21-jamba-large-1-7',
    provider: 'openrouter',
    model: 'ai21/jamba-large-1.7',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-5-chat',
    provider: 'openrouter',
    model: 'openai/gpt-5-chat',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-5',
    provider: 'openrouter',
    model: 'openai/gpt-5',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-5-mini',
    provider: 'openrouter',
    model: 'openai/gpt-5-mini',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-5-nano',
    provider: 'openrouter',
    model: 'openai/gpt-5-nano',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-oss-120b',
    provider: 'openrouter',
    model: 'openai/gpt-oss-120b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-oss-20b-free',
    provider: 'openrouter',
    model: 'openai/gpt-oss-20b:free',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-oss-20b',
    provider: 'openrouter',
    model: 'openai/gpt-oss-20b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-anthropic-claude-opus-4-1',
    provider: 'openrouter',
    model: 'anthropic/claude-opus-4.1',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-mistralai-codestral-2508',
    provider: 'openrouter',
    model: 'mistralai/codestral-2508',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-qwen-qwen3-coder-30b-a3b-instruct',
    provider: 'openrouter',
    model: 'qwen/qwen3-coder-30b-a3b-instruct',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-qwen-qwen3-30b-a3b-instruct-2507',
    provider: 'openrouter',
    model: 'qwen/qwen3-30b-a3b-instruct-2507',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-z-ai-glm-4-5',
    provider: 'openrouter',
    model: 'z-ai/glm-4.5',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-z-ai-glm-4-5-air',
    provider: 'openrouter',
    model: 'z-ai/glm-4.5-air',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-qwen-qwen3-235b-a22b-thinking-2507',
    provider: 'openrouter',
    model: 'qwen/qwen3-235b-a22b-thinking-2507',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-z-ai-glm-4-32b',
    provider: 'openrouter',
    model: 'z-ai/glm-4-32b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-qwen-qwen3-coder',
    provider: 'openrouter',
    model: 'qwen/qwen3-coder',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-bytedance-ui-tars-1-5-7b',
    provider: 'openrouter',
    model: 'bytedance/ui-tars-1.5-7b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-google-gemini-2-5-flash-lite',
    provider: 'openrouter',
    model: 'google/gemini-2.5-flash-lite',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-qwen-qwen3-235b-a22b-2507',
    provider: 'openrouter',
    model: 'qwen/qwen3-235b-a22b-2507',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-switchpoint-router',
    provider: 'openrouter',
    model: 'switchpoint/router',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-moonshotai-kimi-k2',
    provider: 'openrouter',
    model: 'moonshotai/kimi-k2',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-mistralai-devstral-medium',
    provider: 'openrouter',
    model: 'mistralai/devstral-medium',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-mistralai-devstral-small',
    provider: 'openrouter',
    model: 'mistralai/devstral-small',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-cognitivecomputations-dolphin-mistral-24b-venice-',
    provider: 'openrouter',
    model: 'cognitivecomputations/dolphin-mistral-24b-venice-edition:free',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-x-ai-grok-4',
    provider: 'openrouter',
    model: 'x-ai/grok-4',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-google-gemma-3n-e2b-it-free',
    provider: 'openrouter',
    model: 'google/gemma-3n-e2b-it:free',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-tencent-hunyuan-a13b-instruct',
    provider: 'openrouter',
    model: 'tencent/hunyuan-a13b-instruct',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-tngtech-deepseek-r1t2-chimera',
    provider: 'openrouter',
    model: 'tngtech/deepseek-r1t2-chimera',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-morph-morph-v3-large',
    provider: 'openrouter',
    model: 'morph/morph-v3-large',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-morph-morph-v3-fast',
    provider: 'openrouter',
    model: 'morph/morph-v3-fast',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-baidu-ernie-4-5-vl-424b-a47b',
    provider: 'openrouter',
    model: 'baidu/ernie-4.5-vl-424b-a47b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-baidu-ernie-4-5-300b-a47b',
    provider: 'openrouter',
    model: 'baidu/ernie-4.5-300b-a47b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-mistralai-mistral-small-3-2-24b-instruct',
    provider: 'openrouter',
    model: 'mistralai/mistral-small-3.2-24b-instruct',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-minimax-minimax-m1',
    provider: 'openrouter',
    model: 'minimax/minimax-m1',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-google-gemini-2-5-flash',
    provider: 'openrouter',
    model: 'google/gemini-2.5-flash',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-google-gemini-2-5-pro',
    provider: 'openrouter',
    model: 'google/gemini-2.5-pro',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-o3-pro',
    provider: 'openrouter',
    model: 'openai/o3-pro',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-x-ai-grok-3-mini',
    provider: 'openrouter',
    model: 'x-ai/grok-3-mini',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-x-ai-grok-3',
    provider: 'openrouter',
    model: 'x-ai/grok-3',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-google-gemini-2-5-pro-preview',
    provider: 'openrouter',
    model: 'google/gemini-2.5-pro-preview',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-deepseek-deepseek-r1-0528',
    provider: 'openrouter',
    model: 'deepseek/deepseek-r1-0528',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-anthropic-claude-opus-4',
    provider: 'openrouter',
    model: 'anthropic/claude-opus-4',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-anthropic-claude-sonnet-4',
    provider: 'openrouter',
    model: 'anthropic/claude-sonnet-4',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-google-gemma-3n-e4b-it-free',
    provider: 'openrouter',
    model: 'google/gemma-3n-e4b-it:free',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-google-gemma-3n-e4b-it',
    provider: 'openrouter',
    model: 'google/gemma-3n-e4b-it',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-mistralai-mistral-medium-3',
    provider: 'openrouter',
    model: 'mistralai/mistral-medium-3',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-google-gemini-2-5-pro-preview-05-06',
    provider: 'openrouter',
    model: 'google/gemini-2.5-pro-preview-05-06',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-arcee-ai-spotlight',
    provider: 'openrouter',
    model: 'arcee-ai/spotlight',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-arcee-ai-maestro-reasoning',
    provider: 'openrouter',
    model: 'arcee-ai/maestro-reasoning',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-arcee-ai-virtuoso-large',
    provider: 'openrouter',
    model: 'arcee-ai/virtuoso-large',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-arcee-ai-coder-large',
    provider: 'openrouter',
    model: 'arcee-ai/coder-large',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-meta-llama-llama-guard-4-12b',
    provider: 'openrouter',
    model: 'meta-llama/llama-guard-4-12b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-qwen-qwen3-30b-a3b',
    provider: 'openrouter',
    model: 'qwen/qwen3-30b-a3b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-qwen-qwen3-8b',
    provider: 'openrouter',
    model: 'qwen/qwen3-8b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-qwen-qwen3-14b',
    provider: 'openrouter',
    model: 'qwen/qwen3-14b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-qwen-qwen3-32b',
    provider: 'openrouter',
    model: 'qwen/qwen3-32b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-qwen-qwen3-235b-a22b',
    provider: 'openrouter',
    model: 'qwen/qwen3-235b-a22b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-o4-mini-high',
    provider: 'openrouter',
    model: 'openai/o4-mini-high',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-o3',
    provider: 'openrouter',
    model: 'openai/o3',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-o4-mini',
    provider: 'openrouter',
    model: 'openai/o4-mini',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-4-1',
    provider: 'openrouter',
    model: 'openai/gpt-4.1',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-4-1-mini',
    provider: 'openrouter',
    model: 'openai/gpt-4.1-mini',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-4-1-nano',
    provider: 'openrouter',
    model: 'openai/gpt-4.1-nano',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-alfredpros-codellama-7b-instruct-solidity',
    provider: 'openrouter',
    model: 'alfredpros/codellama-7b-instruct-solidity',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-x-ai-grok-3-mini-beta',
    provider: 'openrouter',
    model: 'x-ai/grok-3-mini-beta',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-x-ai-grok-3-beta',
    provider: 'openrouter',
    model: 'x-ai/grok-3-beta',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-meta-llama-llama-4-maverick',
    provider: 'openrouter',
    model: 'meta-llama/llama-4-maverick',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-meta-llama-llama-4-scout',
    provider: 'openrouter',
    model: 'meta-llama/llama-4-scout',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-deepseek-deepseek-chat-v3-0324',
    provider: 'openrouter',
    model: 'deepseek/deepseek-chat-v3-0324',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-o1-pro',
    provider: 'openrouter',
    model: 'openai/o1-pro',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-mistralai-mistral-small-3-1-24b-instruct',
    provider: 'openrouter',
    model: 'mistralai/mistral-small-3.1-24b-instruct',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-google-gemma-3-4b-it-free',
    provider: 'openrouter',
    model: 'google/gemma-3-4b-it:free',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-google-gemma-3-4b-it',
    provider: 'openrouter',
    model: 'google/gemma-3-4b-it',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-google-gemma-3-12b-it',
    provider: 'openrouter',
    model: 'google/gemma-3-12b-it',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-cohere-command-a',
    provider: 'openrouter',
    model: 'cohere/command-a',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-4o-mini-search-preview',
    provider: 'openrouter',
    model: 'openai/gpt-4o-mini-search-preview',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-4o-search-preview',
    provider: 'openrouter',
    model: 'openai/gpt-4o-search-preview',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-rekaai-reka-flash-3',
    provider: 'openrouter',
    model: 'rekaai/reka-flash-3',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-google-gemma-3-27b-it',
    provider: 'openrouter',
    model: 'google/gemma-3-27b-it',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-thedrummer-skyfall-36b-v2',
    provider: 'openrouter',
    model: 'thedrummer/skyfall-36b-v2',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-perplexity-sonar-reasoning-pro',
    provider: 'openrouter',
    model: 'perplexity/sonar-reasoning-pro',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-perplexity-sonar-pro',
    provider: 'openrouter',
    model: 'perplexity/sonar-pro',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-perplexity-sonar-deep-research',
    provider: 'openrouter',
    model: 'perplexity/sonar-deep-research',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-qwen-qwq-32b',
    provider: 'openrouter',
    model: 'qwen/qwq-32b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-google-gemini-2-0-flash-lite-001',
    provider: 'openrouter',
    model: 'google/gemini-2.0-flash-lite-001',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-anthropic-claude-3-7-sonnet',
    provider: 'openrouter',
    model: 'anthropic/claude-3.7-sonnet',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-anthropic-claude-3-7-sonnet-thinking',
    provider: 'openrouter',
    model: 'anthropic/claude-3.7-sonnet:thinking',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-mistralai-mistral-saba',
    provider: 'openrouter',
    model: 'mistralai/mistral-saba',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-meta-llama-llama-guard-3-8b',
    provider: 'openrouter',
    model: 'meta-llama/llama-guard-3-8b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-o3-mini-high',
    provider: 'openrouter',
    model: 'openai/o3-mini-high',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-google-gemini-2-0-flash-001',
    provider: 'openrouter',
    model: 'google/gemini-2.0-flash-001',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-qwen-qwen-vl-plus',
    provider: 'openrouter',
    model: 'qwen/qwen-vl-plus',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-aion-labs-aion-1-0',
    provider: 'openrouter',
    model: 'aion-labs/aion-1.0',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-aion-labs-aion-1-0-mini',
    provider: 'openrouter',
    model: 'aion-labs/aion-1.0-mini',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-aion-labs-aion-rp-llama-3-1-8b',
    provider: 'openrouter',
    model: 'aion-labs/aion-rp-llama-3.1-8b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-qwen-qwen-vl-max',
    provider: 'openrouter',
    model: 'qwen/qwen-vl-max',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-qwen-qwen-turbo',
    provider: 'openrouter',
    model: 'qwen/qwen-turbo',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-qwen-qwen2-5-vl-72b-instruct',
    provider: 'openrouter',
    model: 'qwen/qwen2.5-vl-72b-instruct',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-qwen-qwen-plus',
    provider: 'openrouter',
    model: 'qwen/qwen-plus',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-qwen-qwen-max',
    provider: 'openrouter',
    model: 'qwen/qwen-max',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-o3-mini',
    provider: 'openrouter',
    model: 'openai/o3-mini',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-mistralai-mistral-small-24b-instruct-2501',
    provider: 'openrouter',
    model: 'mistralai/mistral-small-24b-instruct-2501',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-deepseek-deepseek-r1-distill-qwen-32b',
    provider: 'openrouter',
    model: 'deepseek/deepseek-r1-distill-qwen-32b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-perplexity-sonar',
    provider: 'openrouter',
    model: 'perplexity/sonar',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-deepseek-deepseek-r1-distill-llama-70b',
    provider: 'openrouter',
    model: 'deepseek/deepseek-r1-distill-llama-70b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-deepseek-deepseek-r1',
    provider: 'openrouter',
    model: 'deepseek/deepseek-r1',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-minimax-minimax-01',
    provider: 'openrouter',
    model: 'minimax/minimax-01',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-microsoft-phi-4',
    provider: 'openrouter',
    model: 'microsoft/phi-4',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-sao10k-l3-1-70b-hanami-x1',
    provider: 'openrouter',
    model: 'sao10k/l3.1-70b-hanami-x1',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-deepseek-deepseek-chat',
    provider: 'openrouter',
    model: 'deepseek/deepseek-chat',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-sao10k-l3-3-euryale-70b',
    provider: 'openrouter',
    model: 'sao10k/l3.3-euryale-70b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-o1',
    provider: 'openrouter',
    model: 'openai/o1',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-cohere-command-r7b-12-2024',
    provider: 'openrouter',
    model: 'cohere/command-r7b-12-2024',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-meta-llama-llama-3-3-70b-instruct',
    provider: 'openrouter',
    model: 'meta-llama/llama-3.3-70b-instruct',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-amazon-nova-lite-v1',
    provider: 'openrouter',
    model: 'amazon/nova-lite-v1',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-amazon-nova-micro-v1',
    provider: 'openrouter',
    model: 'amazon/nova-micro-v1',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-amazon-nova-pro-v1',
    provider: 'openrouter',
    model: 'amazon/nova-pro-v1',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-4o-2024-11-20',
    provider: 'openrouter',
    model: 'openai/gpt-4o-2024-11-20',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-mistralai-mistral-large-2411',
    provider: 'openrouter',
    model: 'mistralai/mistral-large-2411',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-mistralai-mistral-large-2407',
    provider: 'openrouter',
    model: 'mistralai/mistral-large-2407',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-mistralai-pixtral-large-2411',
    provider: 'openrouter',
    model: 'mistralai/pixtral-large-2411',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-qwen-qwen-2-5-coder-32b-instruct',
    provider: 'openrouter',
    model: 'qwen/qwen-2.5-coder-32b-instruct',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-thedrummer-unslopnemo-12b',
    provider: 'openrouter',
    model: 'thedrummer/unslopnemo-12b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-anthropic-claude-3-5-haiku',
    provider: 'openrouter',
    model: 'anthropic/claude-3.5-haiku',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-anthracite-org-magnum-v4-72b',
    provider: 'openrouter',
    model: 'anthracite-org/magnum-v4-72b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-qwen-qwen-2-5-7b-instruct',
    provider: 'openrouter',
    model: 'qwen/qwen-2.5-7b-instruct',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-nvidia-llama-3-1-nemotron-70b-instruct',
    provider: 'openrouter',
    model: 'nvidia/llama-3.1-nemotron-70b-instruct',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-inflection-inflection-3-productivity',
    provider: 'openrouter',
    model: 'inflection/inflection-3-productivity',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-inflection-inflection-3-pi',
    provider: 'openrouter',
    model: 'inflection/inflection-3-pi',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-thedrummer-rocinante-12b',
    provider: 'openrouter',
    model: 'thedrummer/rocinante-12b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-meta-llama-llama-3-2-3b-instruct',
    provider: 'openrouter',
    model: 'meta-llama/llama-3.2-3b-instruct',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-meta-llama-llama-3-2-1b-instruct',
    provider: 'openrouter',
    model: 'meta-llama/llama-3.2-1b-instruct',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-meta-llama-llama-3-2-11b-vision-instruct',
    provider: 'openrouter',
    model: 'meta-llama/llama-3.2-11b-vision-instruct',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-qwen-qwen-2-5-72b-instruct',
    provider: 'openrouter',
    model: 'qwen/qwen-2.5-72b-instruct',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-cohere-command-r-plus-08-2024',
    provider: 'openrouter',
    model: 'cohere/command-r-plus-08-2024',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-cohere-command-r-08-2024',
    provider: 'openrouter',
    model: 'cohere/command-r-08-2024',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-sao10k-l3-1-euryale-70b',
    provider: 'openrouter',
    model: 'sao10k/l3.1-euryale-70b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-nousresearch-hermes-3-llama-3-1-70b',
    provider: 'openrouter',
    model: 'nousresearch/hermes-3-llama-3.1-70b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-nousresearch-hermes-3-llama-3-1-405b',
    provider: 'openrouter',
    model: 'nousresearch/hermes-3-llama-3.1-405b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-sao10k-l3-lunaris-8b',
    provider: 'openrouter',
    model: 'sao10k/l3-lunaris-8b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-4o-2024-08-06',
    provider: 'openrouter',
    model: 'openai/gpt-4o-2024-08-06',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-meta-llama-llama-3-1-8b-instruct',
    provider: 'openrouter',
    model: 'meta-llama/llama-3.1-8b-instruct',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-meta-llama-llama-3-1-70b-instruct',
    provider: 'openrouter',
    model: 'meta-llama/llama-3.1-70b-instruct',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-mistralai-mistral-nemo',
    provider: 'openrouter',
    model: 'mistralai/mistral-nemo',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-4o-mini-2024-07-18',
    provider: 'openrouter',
    model: 'openai/gpt-4o-mini-2024-07-18',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-4o-mini',
    provider: 'openrouter',
    model: 'openai/gpt-4o-mini',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-google-gemma-2-27b-it',
    provider: 'openrouter',
    model: 'google/gemma-2-27b-it',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-sao10k-l3-euryale-70b',
    provider: 'openrouter',
    model: 'sao10k/l3-euryale-70b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-nousresearch-hermes-2-pro-llama-3-8b',
    provider: 'openrouter',
    model: 'nousresearch/hermes-2-pro-llama-3-8b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-4o-2024-05-13',
    provider: 'openrouter',
    model: 'openai/gpt-4o-2024-05-13',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-4o',
    provider: 'openrouter',
    model: 'openai/gpt-4o',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-meta-llama-llama-3-8b-instruct',
    provider: 'openrouter',
    model: 'meta-llama/llama-3-8b-instruct',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-meta-llama-llama-3-70b-instruct',
    provider: 'openrouter',
    model: 'meta-llama/llama-3-70b-instruct',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-mistralai-mixtral-8x22b-instruct',
    provider: 'openrouter',
    model: 'mistralai/mixtral-8x22b-instruct',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-microsoft-wizardlm-2-8x22b',
    provider: 'openrouter',
    model: 'microsoft/wizardlm-2-8x22b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-4-turbo',
    provider: 'openrouter',
    model: 'openai/gpt-4-turbo',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-anthropic-claude-3-haiku',
    provider: 'openrouter',
    model: 'anthropic/claude-3-haiku',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-mistralai-mistral-large',
    provider: 'openrouter',
    model: 'mistralai/mistral-large',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-4-turbo-preview',
    provider: 'openrouter',
    model: 'openai/gpt-4-turbo-preview',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-3-5-turbo-0613',
    provider: 'openrouter',
    model: 'openai/gpt-3.5-turbo-0613',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-mistralai-mixtral-8x7b-instruct',
    provider: 'openrouter',
    model: 'mistralai/mixtral-8x7b-instruct',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-alpindale-goliath-120b',
    provider: 'openrouter',
    model: 'alpindale/goliath-120b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openrouter-auto',
    provider: 'openrouter',
    model: 'openrouter/auto',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-4-1106-preview',
    provider: 'openrouter',
    model: 'openai/gpt-4-1106-preview',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-3-5-turbo-instruct',
    provider: 'openrouter',
    model: 'openai/gpt-3.5-turbo-instruct',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-mistralai-mistral-7b-instruct-v0-1',
    provider: 'openrouter',
    model: 'mistralai/mistral-7b-instruct-v0.1',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-3-5-turbo-16k',
    provider: 'openrouter',
    model: 'openai/gpt-3.5-turbo-16k',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-mancer-weaver',
    provider: 'openrouter',
    model: 'mancer/weaver',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-undi95-remm-slerp-l2-13b',
    provider: 'openrouter',
    model: 'undi95/remm-slerp-l2-13b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-gryphe-mythomax-l2-13b',
    provider: 'openrouter',
    model: 'gryphe/mythomax-l2-13b',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-4-0314',
    provider: 'openrouter',
    model: 'openai/gpt-4-0314',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-4',
    provider: 'openrouter',
    model: 'openai/gpt-4',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'openrouter-openai-gpt-3-5-turbo',
    provider: 'openrouter',
    model: 'openai/gpt-3.5-turbo',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'cerebras-zai-glm-4-7',
    provider: 'cerebras',
    model: 'zai-glm-4.7',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
  },
  {
    id: 'cerebras-qwen-3-235b-a22b-instruct-2507',
    provider: 'cerebras',
    model: 'qwen-3-235b-a22b-instruct-2507',
    reasoning: 'medium',
    supportsStreaming: true,
    enabled: true,
    priority: 0.50, // AUTO-ADDED by check-model-ids — review caps + priority
    capabilities: { toolCalling: false, jsonMode: true, vision: false, contextWindow: 32768, maxOutputTokens: 4096 },
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
  'groq:qwen/qwen3-32b': { requestsPerDay: 500 },
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
  'openrouter:qwen/qwen3-coder:free': { requestsPerDay: 50 },
  'openrouter:google/gemma-3-12b-it:free': { requestsPerDay: 100 },
  'openrouter:nvidia/nemotron-nano-12b-v2-vl:free': { requestsPerDay: 100 },
  'openrouter:z-ai/glm-4.5-air:free': { requestsPerDay: 50 },
  'openrouter:meta-llama/llama-3.2-3b-instruct:free': { requestsPerDay: 100 },
  // Cerebras
  'cerebras:gpt-oss-120b': { requestsPerDay: 300 },
  'cerebras:llama3.1-8b': { requestsPerDay: 1000 },
  // SambaNova (free tier, 10-20 RPM)
  'sambanova:Meta-Llama-3.3-70B-Instruct': { requestsPerDay: 500 },
  'sambanova:DeepSeek-V3-0324': { requestsPerDay: 300 },
  'sambanova:Qwen3-32B': { requestsPerDay: 500 },
  // NVIDIA NIM (free tier, ~40 RPM)
  'nvidia:meta/llama-3.3-70b-instruct': { requestsPerDay: 500 },
  'nvidia:deepseek-ai/deepseek-r1': { requestsPerDay: 300 },
  'nvidia:qwen/qwen3-32b': { requestsPerDay: 500 },
  'nvidia:nvidia/llama-3.3-nemotron-super-49b-v1': { requestsPerDay: 500 },
  'nvidia:nvidia/llama-3.1-nemotron-70b-instruct': { requestsPerDay: 500 },
  'nvidia:meta/llama-4-maverick-17b-128e-instruct': { requestsPerDay: 500 },
  'nvidia:meta/llama-4-scout-17b-16e-instruct': { requestsPerDay: 500 },
  'nvidia:deepseek-ai/deepseek-v3': { requestsPerDay: 300 },
  'nvidia:deepseek-ai/deepseek-r1-distill-llama-70b': { requestsPerDay: 300 },
  'nvidia:mistralai/mixtral-8x22b-instruct-v0.1': { requestsPerDay: 300 },
  'nvidia:qwen/qwen2.5-coder-32b-instruct': { requestsPerDay: 500 },
  'nvidia:google/gemma-3-27b-it': { requestsPerDay: 500 },
  'nvidia:microsoft/phi-4': { requestsPerDay: 500 },
  // GitHub Models (free tier ~50 req/day per high-tier, 150/day low-tier)
  'github_models:openai/gpt-5': { requestsPerDay: 50 },
  'github_models:openai/gpt-5-mini': { requestsPerDay: 150 },
  'github_models:openai/gpt-5-nano': { requestsPerDay: 150 },
  'github_models:openai/gpt-4.1': { requestsPerDay: 50 },
  'github_models:openai/gpt-4.1-mini': { requestsPerDay: 150 },
  'github_models:openai/gpt-4o-mini': { requestsPerDay: 150 },
  'github_models:openai/o3': { requestsPerDay: 50 },
  'github_models:openai/o4-mini': { requestsPerDay: 50 },
  'github_models:deepseek/deepseek-r1': { requestsPerDay: 50 },
  'github_models:deepseek/deepseek-r1-0528': { requestsPerDay: 50 },
  'github_models:deepseek/deepseek-v3-0324': { requestsPerDay: 50 },
  'github_models:meta/llama-4-maverick-17b-128e-instruct-fp8': { requestsPerDay: 150 },
  'github_models:meta/llama-4-scout-17b-16e-instruct': { requestsPerDay: 150 },
  'github_models:meta/llama-3.3-70b-instruct': { requestsPerDay: 150 },
  'github_models:xai/grok-3': { requestsPerDay: 50 },
  'github_models:xai/grok-3-mini': { requestsPerDay: 150 },
  'github_models:mistral-ai/codestral-2501': { requestsPerDay: 150 },
  'github_models:mistral-ai/mistral-medium-2505': { requestsPerDay: 150 },
  'github_models:cohere/cohere-command-a': { requestsPerDay: 150 },
  'github_models:cohere/cohere-command-r-plus-08-2024': { requestsPerDay: 150 },
  'github_models:microsoft/phi-4': { requestsPerDay: 150 },
  'github_models:microsoft/phi-4-reasoning': { requestsPerDay: 150 },
  'github_models:microsoft/mai-ds-r1': { requestsPerDay: 50 },
  // Pollinations (no key required, IP-rate-limited upstream)
  'pollinations:openai': { requestsPerDay: 300 },
  'pollinations:openai-large': { requestsPerDay: 300 },
  'pollinations:mistral': { requestsPerDay: 300 },
  'pollinations:qwen-coder': { requestsPerDay: 300 },
  'pollinations:deepseek-reasoning': { requestsPerDay: 300 },
  'pollinations:llamascout': { requestsPerDay: 300 },
  // Cohere (trial: 1000 req/mo ≈ 33/day across all models)
  'cohere:command-a-03-2025': { requestsPerDay: 10 },
  'cohere:command-r-plus-08-2024': { requestsPerDay: 10 },
  'cohere:command-r-08-2024': { requestsPerDay: 10 },
  'cohere:command-r7b-12-2024': { requestsPerDay: 10 },
  // Mistral (Experiment tier, generous but 1 RPS)
  'mistral:mistral-large-latest': { requestsPerDay: 500 },
  'mistral:mistral-medium-latest': { requestsPerDay: 500 },
  'mistral:mistral-small-latest': { requestsPerDay: 1000 },
  'mistral:codestral-latest': { requestsPerDay: 500 },
  'mistral:ministral-8b-latest': { requestsPerDay: 1000 },
  'mistral:ministral-3b-latest': { requestsPerDay: 1000 },
  'mistral:pixtral-large-latest': { requestsPerDay: 300 },
  // AUTO-ADDED limits
  'groq:meta-llama/llama-prompt-guard-2-86m': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'groq:openai/gpt-oss-safeguard-20b': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'groq:meta-llama/llama-prompt-guard-2-22m': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'groq:allam-2-7b': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'groq:groq/compound-mini': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'groq:canopylabs/orpheus-v1-english': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'groq:groq/compound': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'groq:canopylabs/orpheus-arabic-saudi': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:tencent/hy3-preview:free': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:xiaomi/mimo-v2.5-pro': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:xiaomi/mimo-v2.5': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-5.4-image-2': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:inclusionai/ling-2.6-flash:free': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:~anthropic/claude-opus-latest': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openrouter/pareto-code': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:baidu/qianfan-ocr-fast:free': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:moonshotai/kimi-k2.6': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:anthropic/claude-opus-4.7': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:anthropic/claude-opus-4.6-fast': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:z-ai/glm-5.1': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:google/gemma-4-26b-a4b-it:free': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:google/gemma-4-26b-a4b-it': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:google/gemma-4-31b-it:free': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:google/gemma-4-31b-it': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:qwen/qwen3.6-plus': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:z-ai/glm-5v-turbo': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:arcee-ai/trinity-large-thinking': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:x-ai/grok-4.20-multi-agent': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:x-ai/grok-4.20': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:google/lyria-3-pro-preview': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:google/lyria-3-clip-preview': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:kwaipilot/kat-coder-pro-v2': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:rekaai/reka-edge': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:xiaomi/mimo-v2-omni': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:xiaomi/mimo-v2-pro': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:minimax/minimax-m2.7': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-5.4-nano': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-5.4-mini': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:mistralai/mistral-small-2603': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:z-ai/glm-5-turbo': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:nvidia/nemotron-3-super-120b-a12b:free': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:nvidia/nemotron-3-super-120b-a12b': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:bytedance-seed/seed-2.0-lite': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:qwen/qwen3.5-9b': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-5.4-pro': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-5.4': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:inception/mercury-2': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-5.3-chat': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:google/gemini-3.1-flash-lite-preview': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:bytedance-seed/seed-2.0-mini': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:google/gemini-3.1-flash-image-preview': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:qwen/qwen3.5-35b-a3b': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:qwen/qwen3.5-27b': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:qwen/qwen3.5-122b-a10b': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:qwen/qwen3.5-flash-02-23': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:liquid/lfm-2-24b-a2b': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:google/gemini-3.1-pro-preview-customtools': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-5.3-codex': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:aion-labs/aion-2.0': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:google/gemini-3.1-pro-preview': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:anthropic/claude-sonnet-4.6': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:qwen/qwen3.5-plus-02-15': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:qwen/qwen3.5-397b-a17b': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:minimax/minimax-m2.5:free': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:minimax/minimax-m2.5': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:z-ai/glm-5': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:qwen/qwen3-max-thinking': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:anthropic/claude-opus-4.6': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:qwen/qwen3-coder-next': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openrouter/free': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:stepfun/step-3.5-flash': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:arcee-ai/trinity-large-preview': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:moonshotai/kimi-k2.5': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:upstage/solar-pro-3': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:minimax/minimax-m2-her': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:writer/palmyra-x5': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:liquid/lfm-2.5-1.2b-thinking:free': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:liquid/lfm-2.5-1.2b-instruct:free': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-audio': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-audio-mini': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:z-ai/glm-4.7-flash': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-5.2-codex': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:allenai/olmo-3.1-32b-instruct': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:bytedance-seed/seed-1.6-flash': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:bytedance-seed/seed-1.6': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:minimax/minimax-m2.1': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:z-ai/glm-4.7': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:google/gemini-3-flash-preview': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:mistralai/mistral-small-creative': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:xiaomi/mimo-v2-flash': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:nvidia/nemotron-3-nano-30b-a3b:free': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:nvidia/nemotron-3-nano-30b-a3b': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-5.2-chat': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-5.2-pro': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-5.2': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:mistralai/devstral-2512': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:relace/relace-search': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:z-ai/glm-4.6v': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:nex-agi/deepseek-v3.1-nex-n1': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:essentialai/rnj-1-instruct': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openrouter/bodybuilder': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-5.1-codex-max': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:amazon/nova-2-lite-v1': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:mistralai/ministral-14b-2512': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:mistralai/ministral-8b-2512': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:mistralai/ministral-3b-2512': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:mistralai/mistral-large-2512': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:arcee-ai/trinity-mini': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:deepseek/deepseek-v3.2-speciale': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:deepseek/deepseek-v3.2': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:prime-intellect/intellect-3': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:anthropic/claude-opus-4.5': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:allenai/olmo-3-32b-think': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:google/gemini-3-pro-image-preview': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:x-ai/grok-4.1-fast': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-5.1': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-5.1-chat': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-5.1-codex': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-5.1-codex-mini': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:moonshotai/kimi-k2-thinking': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:amazon/nova-premier-v1': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:perplexity/sonar-pro-search': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:mistralai/voxtral-small-24b-2507': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-oss-safeguard-20b': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:nvidia/nemotron-nano-12b-v2-vl': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:minimax/minimax-m2': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:qwen/qwen3-vl-32b-instruct': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:ibm-granite/granite-4.0-h-micro': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-5-image-mini': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:anthropic/claude-haiku-4.5': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:qwen/qwen3-vl-8b-thinking': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:qwen/qwen3-vl-8b-instruct': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-5-image': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/o3-deep-research': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/o4-mini-deep-research': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:nvidia/llama-3.3-nemotron-super-49b-v1.5': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:baidu/ernie-4.5-21b-a3b-thinking': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:google/gemini-2.5-flash-image': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:qwen/qwen3-vl-30b-a3b-thinking': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:qwen/qwen3-vl-30b-a3b-instruct': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-5-pro': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:z-ai/glm-4.6': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:anthropic/claude-sonnet-4.5': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:deepseek/deepseek-v3.2-exp': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:thedrummer/cydonia-24b-v4.1': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:relace/relace-apply-3': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:google/gemini-2.5-flash-lite-preview-09-2025': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:qwen/qwen3-vl-235b-a22b-thinking': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:qwen/qwen3-vl-235b-a22b-instruct': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:qwen/qwen3-max': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:qwen/qwen3-coder-plus': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-5-codex': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:deepseek/deepseek-v3.1-terminus': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:x-ai/grok-4-fast': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:alibaba/tongyi-deepresearch-30b-a3b': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:qwen/qwen3-coder-flash': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:qwen/qwen3-next-80b-a3b-thinking': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:qwen/qwen3-next-80b-a3b-instruct': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:qwen/qwen-plus-2025-07-28:thinking': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:qwen/qwen-plus-2025-07-28': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:nvidia/nemotron-nano-9b-v2:free': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:nvidia/nemotron-nano-9b-v2': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:moonshotai/kimi-k2-0905': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:qwen/qwen3-30b-a3b-thinking-2507': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:x-ai/grok-code-fast-1': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:nousresearch/hermes-4-70b': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:nousresearch/hermes-4-405b': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:deepseek/deepseek-chat-v3.1': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-4o-audio-preview': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:mistralai/mistral-medium-3.1': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:baidu/ernie-4.5-21b-a3b': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:baidu/ernie-4.5-vl-28b-a3b': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:z-ai/glm-4.5v': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:ai21/jamba-large-1.7': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-5-chat': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-5': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-5-mini': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-5-nano': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-oss-120b': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-oss-20b:free': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-oss-20b': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:anthropic/claude-opus-4.1': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:mistralai/codestral-2508': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:qwen/qwen3-coder-30b-a3b-instruct': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:qwen/qwen3-30b-a3b-instruct-2507': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:z-ai/glm-4.5': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:z-ai/glm-4.5-air': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:qwen/qwen3-235b-a22b-thinking-2507': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:z-ai/glm-4-32b': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:qwen/qwen3-coder': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:bytedance/ui-tars-1.5-7b': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:google/gemini-2.5-flash-lite': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:qwen/qwen3-235b-a22b-2507': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:switchpoint/router': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:moonshotai/kimi-k2': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:mistralai/devstral-medium': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:mistralai/devstral-small': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:cognitivecomputations/dolphin-mistral-24b-venice-edition:free': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:x-ai/grok-4': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:google/gemma-3n-e2b-it:free': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:tencent/hunyuan-a13b-instruct': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:tngtech/deepseek-r1t2-chimera': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:morph/morph-v3-large': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:morph/morph-v3-fast': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:baidu/ernie-4.5-vl-424b-a47b': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:baidu/ernie-4.5-300b-a47b': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:mistralai/mistral-small-3.2-24b-instruct': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:minimax/minimax-m1': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:google/gemini-2.5-flash': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:google/gemini-2.5-pro': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/o3-pro': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:x-ai/grok-3-mini': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:x-ai/grok-3': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:google/gemini-2.5-pro-preview': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:deepseek/deepseek-r1-0528': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:anthropic/claude-opus-4': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:anthropic/claude-sonnet-4': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:google/gemma-3n-e4b-it:free': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:google/gemma-3n-e4b-it': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:mistralai/mistral-medium-3': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:google/gemini-2.5-pro-preview-05-06': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:arcee-ai/spotlight': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:arcee-ai/maestro-reasoning': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:arcee-ai/virtuoso-large': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:arcee-ai/coder-large': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:meta-llama/llama-guard-4-12b': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:qwen/qwen3-30b-a3b': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:qwen/qwen3-8b': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:qwen/qwen3-14b': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:qwen/qwen3-32b': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:qwen/qwen3-235b-a22b': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/o4-mini-high': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/o3': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/o4-mini': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-4.1': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-4.1-mini': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-4.1-nano': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:alfredpros/codellama-7b-instruct-solidity': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:x-ai/grok-3-mini-beta': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:x-ai/grok-3-beta': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:meta-llama/llama-4-maverick': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:meta-llama/llama-4-scout': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:deepseek/deepseek-chat-v3-0324': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/o1-pro': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:mistralai/mistral-small-3.1-24b-instruct': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:google/gemma-3-4b-it:free': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:google/gemma-3-4b-it': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:google/gemma-3-12b-it': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:cohere/command-a': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-4o-mini-search-preview': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-4o-search-preview': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:rekaai/reka-flash-3': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:google/gemma-3-27b-it': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:thedrummer/skyfall-36b-v2': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:perplexity/sonar-reasoning-pro': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:perplexity/sonar-pro': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:perplexity/sonar-deep-research': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:qwen/qwq-32b': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:google/gemini-2.0-flash-lite-001': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:anthropic/claude-3.7-sonnet': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:anthropic/claude-3.7-sonnet:thinking': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:mistralai/mistral-saba': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:meta-llama/llama-guard-3-8b': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/o3-mini-high': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:google/gemini-2.0-flash-001': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:qwen/qwen-vl-plus': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:aion-labs/aion-1.0': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:aion-labs/aion-1.0-mini': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:aion-labs/aion-rp-llama-3.1-8b': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:qwen/qwen-vl-max': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:qwen/qwen-turbo': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:qwen/qwen2.5-vl-72b-instruct': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:qwen/qwen-plus': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:qwen/qwen-max': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/o3-mini': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:mistralai/mistral-small-24b-instruct-2501': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:deepseek/deepseek-r1-distill-qwen-32b': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:perplexity/sonar': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:deepseek/deepseek-r1-distill-llama-70b': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:deepseek/deepseek-r1': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:minimax/minimax-01': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:microsoft/phi-4': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:sao10k/l3.1-70b-hanami-x1': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:deepseek/deepseek-chat': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:sao10k/l3.3-euryale-70b': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/o1': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:cohere/command-r7b-12-2024': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:meta-llama/llama-3.3-70b-instruct': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:amazon/nova-lite-v1': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:amazon/nova-micro-v1': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:amazon/nova-pro-v1': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-4o-2024-11-20': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:mistralai/mistral-large-2411': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:mistralai/mistral-large-2407': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:mistralai/pixtral-large-2411': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:qwen/qwen-2.5-coder-32b-instruct': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:thedrummer/unslopnemo-12b': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:anthropic/claude-3.5-haiku': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:anthracite-org/magnum-v4-72b': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:qwen/qwen-2.5-7b-instruct': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:nvidia/llama-3.1-nemotron-70b-instruct': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:inflection/inflection-3-productivity': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:inflection/inflection-3-pi': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:thedrummer/rocinante-12b': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:meta-llama/llama-3.2-3b-instruct': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:meta-llama/llama-3.2-1b-instruct': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:meta-llama/llama-3.2-11b-vision-instruct': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:qwen/qwen-2.5-72b-instruct': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:cohere/command-r-plus-08-2024': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:cohere/command-r-08-2024': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:sao10k/l3.1-euryale-70b': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:nousresearch/hermes-3-llama-3.1-70b': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:nousresearch/hermes-3-llama-3.1-405b': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:sao10k/l3-lunaris-8b': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-4o-2024-08-06': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:meta-llama/llama-3.1-8b-instruct': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:meta-llama/llama-3.1-70b-instruct': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:mistralai/mistral-nemo': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-4o-mini-2024-07-18': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-4o-mini': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:google/gemma-2-27b-it': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:sao10k/l3-euryale-70b': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:nousresearch/hermes-2-pro-llama-3-8b': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-4o-2024-05-13': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-4o': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:meta-llama/llama-3-8b-instruct': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:meta-llama/llama-3-70b-instruct': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:mistralai/mixtral-8x22b-instruct': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:microsoft/wizardlm-2-8x22b': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-4-turbo': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:anthropic/claude-3-haiku': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:mistralai/mistral-large': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-4-turbo-preview': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-3.5-turbo-0613': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:mistralai/mixtral-8x7b-instruct': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:alpindale/goliath-120b': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openrouter/auto': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-4-1106-preview': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-3.5-turbo-instruct': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:mistralai/mistral-7b-instruct-v0.1': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-3.5-turbo-16k': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:mancer/weaver': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:undi95/remm-slerp-l2-13b': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:gryphe/mythomax-l2-13b': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-4-0314': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-4': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'openrouter:openai/gpt-3.5-turbo': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'cerebras:zai-glm-4.7': { requestsPerDay: 100 }, // AUTO-ADDED — tune
  'cerebras:qwen-3-235b-a22b-instruct-2507': { requestsPerDay: 100 }, // AUTO-ADDED — tune
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
  sambanova: true,
  nvidia: true,
  github_models: true,
  pollinations: false,
  cohere: true,
  mistral: true,
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
    case 'sambanova':
      return Boolean(env.SAMBANOVA_API_KEY);
    case 'nvidia':
      return Boolean(env.NVIDIA_API_KEY);
    case 'github_models':
      return Boolean(env.GITHUB_TOKEN);
    case 'pollinations':
      return true;
    case 'cohere':
      return Boolean(env.COHERE_API_KEY);
    case 'mistral':
      return Boolean(env.MISTRAL_API_KEY);
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

// ═══════════════════════════════════════════════════════════════════
// Multi-modal registries: image, video, TTS, STT
// ═══════════════════════════════════════════════════════════════════

import type {
  AudioSttModelCandidate,
  AudioSttProvider,
  AudioTtsModelCandidate,
  AudioTtsProvider,
  ImageModelCandidate,
  ImageProvider,
  VideoModelCandidate,
  VideoProvider,
} from './types';

const DEFAULT_IMAGE_MODELS: ImageModelCandidate[] = [
  // Together (free via key)
  { id: 'flux-schnell', provider: 'together', model: 'black-forest-labs/FLUX.1-schnell', enabled: true, priority: 0.90 },
  { id: 'flux-1.1-pro', provider: 'together', model: 'black-forest-labs/FLUX.1.1-pro', enabled: true, priority: 0.85 },
  { id: 'flux-kontext-pro', provider: 'together', model: 'black-forest-labs/FLUX.1-kontext-pro', enabled: true, priority: 0.83 },
  { id: 'flux-2-dev', provider: 'together', model: 'black-forest-labs/FLUX.2-dev', enabled: true, priority: 0.82 },
  { id: 'flux-2-flex', provider: 'together', model: 'black-forest-labs/FLUX.2-flex', enabled: true, priority: 0.80 },
  { id: 'flux-2-pro', provider: 'together', model: 'black-forest-labs/FLUX.2-pro', enabled: true, priority: 0.88 },
  { id: 'flux-2-max', provider: 'together', model: 'black-forest-labs/FLUX.2-max', enabled: true, priority: 0.91 },
  // Gemini Imagen
  { id: 'imagen-4', provider: 'gemini', model: 'imagen-4.0-generate-001', enabled: true, priority: 0.86 },
  { id: 'gemini-flash-image', provider: 'gemini', model: 'gemini-2.5-flash-image', enabled: true, priority: 0.82 },
  // Workers AI
  { id: 'cf-flux-schnell', provider: 'workers_ai', model: '@cf/black-forest-labs/flux-1-schnell', enabled: true, priority: 0.78 },
  { id: 'cf-sdxl', provider: 'workers_ai', model: '@cf/stabilityai/stable-diffusion-xl-base-1.0', enabled: true, priority: 0.72 },
  { id: 'cf-dreamshaper', provider: 'workers_ai', model: '@cf/lykon/dreamshaper-8-lcm', enabled: true, priority: 0.70 },
  // NVIDIA NIM
  { id: 'nvidia-flux-schnell', provider: 'nvidia', model: 'black-forest-labs/flux.1-schnell', enabled: true, priority: 0.76 },
  { id: 'nvidia-sdxl', provider: 'nvidia', model: 'stabilityai/stable-diffusion-xl', enabled: false, priority: 0.70 }, // NVIDIA NIM function id not found (404)
  // Pollinations (no key)
  { id: 'pollinations-flux', provider: 'pollinations', model: 'flux', enabled: true, priority: 0.60 },
  { id: 'pollinations-flux-realism', provider: 'pollinations', model: 'flux-realism', enabled: true, priority: 0.58 },
  { id: 'pollinations-turbo', provider: 'pollinations', model: 'turbo', enabled: true, priority: 0.55 },
];

const DEFAULT_VIDEO_MODELS: VideoModelCandidate[] = [
  { id: 'veo-3-audio', provider: 'together', model: 'google/veo-3.0-audio', enabled: true, priority: 0.95 },
  { id: 'veo-3-fast-audio', provider: 'together', model: 'google/veo-3.0-fast-audio', enabled: true, priority: 0.93 },
  { id: 'veo-2', provider: 'together', model: 'google/veo-2.0', enabled: true, priority: 0.88 },
  { id: 'sora-2', provider: 'together', model: 'openai/sora-2', enabled: true, priority: 0.94 },
  { id: 'kling-2.1-master', provider: 'together', model: 'kwaivgI/kling-2.1-master', enabled: true, priority: 0.90 },
  { id: 'kling-2.1-pro', provider: 'together', model: 'kwaivgI/kling-2.1-pro', enabled: true, priority: 0.87 },
  { id: 'kling-2.0-master', provider: 'together', model: 'kwaivgI/kling-2.0-master', enabled: true, priority: 0.84 },
  { id: 'kling-1.6-pro', provider: 'together', model: 'kwaivgI/kling-1.6-pro', enabled: true, priority: 0.80 },
  { id: 'wan-2.6-image', provider: 'together', model: 'Wan-AI/Wan2.6-image', enabled: true, priority: 0.78, supportsImageToVideo: true },
  { id: 'wan-2.2-i2v', provider: 'together', model: 'Wan-AI/Wan2.2-I2V-A14B', enabled: true, priority: 0.76, supportsImageToVideo: true },
  { id: 'vidu-q1', provider: 'together', model: 'vidu/vidu-q1', enabled: true, priority: 0.74 },
  { id: 'seedream-3', provider: 'together', model: 'ByteDance-Seed/Seedream-3.0', enabled: true, priority: 0.82 },
  { id: 'seedream-4', provider: 'together', model: 'ByteDance-Seed/Seedream-4.0', enabled: true, priority: 0.85 },
];

const DEFAULT_TTS_MODELS: AudioTtsModelCandidate[] = [
  {
    id: 'cf-melotts',
    provider: 'workers_ai',
    model: '@cf/myshell-ai/melotts',
    enabled: true,
    priority: 0.70,
    voices: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
  },
];

const DEFAULT_STT_MODELS: AudioSttModelCandidate[] = [
  { id: 'groq-whisper-turbo', provider: 'groq', model: 'whisper-large-v3-turbo', enabled: true, priority: 0.95 },
  { id: 'groq-whisper-v3', provider: 'groq', model: 'whisper-large-v3', enabled: true, priority: 0.90 },
  { id: 'cf-whisper', provider: 'workers_ai', model: '@cf/openai/whisper', enabled: true, priority: 0.75 },
  { id: 'gemini-audio', provider: 'gemini', model: 'gemini-2.5-flash', enabled: true, priority: 0.78 },
];

const DEFAULT_MODALITY_LIMITS: Record<string, ProviderLimitConfig> = {
  // Image: Together free tier is generous for schnell but paid for pro.
  'together:black-forest-labs/FLUX.1-schnell': { requestsPerDay: 300 },
  'together:black-forest-labs/FLUX.1.1-pro': { requestsPerDay: 100 },
  'together:black-forest-labs/FLUX.1-kontext-pro': { requestsPerDay: 100 },
  'together:black-forest-labs/FLUX.2-dev': { requestsPerDay: 150 },
  'together:black-forest-labs/FLUX.2-flex': { requestsPerDay: 150 },
  'together:black-forest-labs/FLUX.2-pro': { requestsPerDay: 100 },
  'together:black-forest-labs/FLUX.2-max': { requestsPerDay: 50 },
  'gemini:imagen-4.0-generate-001': { requestsPerDay: 50 },
  'gemini:gemini-2.5-flash-image': { requestsPerDay: 200 },
  'workers_ai:@cf/black-forest-labs/flux-1-schnell': { requestsPerDay: 500 },
  'workers_ai:@cf/stabilityai/stable-diffusion-xl-base-1.0': { requestsPerDay: 500 },
  'workers_ai:@cf/lykon/dreamshaper-8-lcm': { requestsPerDay: 500 },
  'nvidia:black-forest-labs/flux.1-schnell': { requestsPerDay: 200 },
  'nvidia:stabilityai/stable-diffusion-xl': { requestsPerDay: 200 },
  'pollinations:flux': { requestsPerDay: 300 },
  'pollinations:flux-realism': { requestsPerDay: 300 },
  'pollinations:turbo': { requestsPerDay: 300 },
  // Video: low per-day on free tier due to cost-per-call.
  'together:google/veo-3.0-audio': { requestsPerDay: 10 },
  'together:google/veo-3.0-fast-audio': { requestsPerDay: 20 },
  'together:google/veo-2.0': { requestsPerDay: 20 },
  'together:openai/sora-2': { requestsPerDay: 10 },
  'together:kwaivgI/kling-2.1-master': { requestsPerDay: 10 },
  'together:kwaivgI/kling-2.1-pro': { requestsPerDay: 15 },
  'together:kwaivgI/kling-2.0-master': { requestsPerDay: 15 },
  'together:kwaivgI/kling-1.6-pro': { requestsPerDay: 20 },
  'together:Wan-AI/Wan2.6-image': { requestsPerDay: 30 },
  'together:Wan-AI/Wan2.2-I2V-A14B': { requestsPerDay: 30 },
  'together:vidu/vidu-q1': { requestsPerDay: 30 },
  'together:ByteDance-Seed/Seedream-3.0': { requestsPerDay: 20 },
  'together:ByteDance-Seed/Seedream-4.0': { requestsPerDay: 15 },
  // TTS
  'workers_ai:@cf/myshell-ai/melotts': { requestsPerDay: 500 },
  // STT
  'groq:whisper-large-v3-turbo': { requestsPerDay: 1000 },
  'groq:whisper-large-v3': { requestsPerDay: 500 },
  'workers_ai:@cf/openai/whisper': { requestsPerDay: 1000 },
  'gemini:gemini-2.5-flash': { requestsPerDay: 500 },
};

// Merge modality limits into DEFAULT_LIMITS at module load.
for (const [key, value] of Object.entries(DEFAULT_MODALITY_LIMITS)) {
  if (!(key in DEFAULT_LIMITS)) {
    DEFAULT_LIMITS[key] = value;
  }
}

const IMAGE_PROVIDER_KEY_REQUIRED: Record<ImageProvider, boolean> = {
  together: true,
  workers_ai: false,
  pollinations: false,
  gemini: true,
  nvidia: true,
};

const VIDEO_PROVIDER_KEY_REQUIRED: Record<VideoProvider, boolean> = {
  together: true,
};

const TTS_PROVIDER_KEY_REQUIRED: Record<AudioTtsProvider, boolean> = {
  workers_ai: false,
  groq: true,
};

const STT_PROVIDER_KEY_REQUIRED: Record<AudioSttProvider, boolean> = {
  groq: true,
  workers_ai: false,
  gemini: true,
};

export function hasImageProviderKey(env: Env, provider: ImageProvider): boolean {
  switch (provider) {
    case 'together':
      return Boolean(env.TOGETHER_API_KEY);
    case 'workers_ai':
      return Boolean(env.AI) || Boolean(env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_WORKERS_AI_API_KEY);
    case 'pollinations':
      return true;
    case 'gemini':
      return Boolean(env.GEMINI_API_KEY);
    case 'nvidia':
      return Boolean(env.NVIDIA_API_KEY);
    default:
      return false;
  }
}

export function hasVideoProviderKey(env: Env, provider: VideoProvider): boolean {
  switch (provider) {
    case 'together':
      return Boolean(env.TOGETHER_API_KEY);
    default:
      return false;
  }
}

export function hasTtsProviderKey(env: Env, provider: AudioTtsProvider): boolean {
  switch (provider) {
    case 'groq':
      return Boolean(env.GROQ_API_KEY);
    case 'workers_ai':
      return Boolean(env.AI) || Boolean(env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_WORKERS_AI_API_KEY);
    default:
      return false;
  }
}

export function hasSttProviderKey(env: Env, provider: AudioSttProvider): boolean {
  switch (provider) {
    case 'groq':
      return Boolean(env.GROQ_API_KEY);
    case 'workers_ai':
      return Boolean(env.AI) || Boolean(env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_WORKERS_AI_API_KEY);
    case 'gemini':
      return Boolean(env.GEMINI_API_KEY);
    default:
      return false;
  }
}

export function getImageRegistry(env: Env): ImageModelCandidate[] {
  return DEFAULT_IMAGE_MODELS.filter((candidate) => {
    if (!candidate.enabled) return false;
    if (IMAGE_PROVIDER_KEY_REQUIRED[candidate.provider] && !hasImageProviderKey(env, candidate.provider)) {
      return false;
    }
    if (!IMAGE_PROVIDER_KEY_REQUIRED[candidate.provider] && !hasImageProviderKey(env, candidate.provider)) {
      return false;
    }
    return true;
  });
}

export function getVideoRegistry(env: Env): VideoModelCandidate[] {
  return DEFAULT_VIDEO_MODELS.filter((candidate) => {
    if (!candidate.enabled) return false;
    if (!hasVideoProviderKey(env, candidate.provider)) return false;
    return true;
  });
}

export function getTtsRegistry(env: Env): AudioTtsModelCandidate[] {
  return DEFAULT_TTS_MODELS.filter((candidate) => {
    if (!candidate.enabled) return false;
    if (!hasTtsProviderKey(env, candidate.provider)) return false;
    return true;
  });
}

export function getSttRegistry(env: Env): AudioSttModelCandidate[] {
  return DEFAULT_STT_MODELS.filter((candidate) => {
    if (!candidate.enabled) return false;
    if (!hasSttProviderKey(env, candidate.provider)) return false;
    return true;
  });
}
