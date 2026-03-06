export type TextProvider = 'workers_ai' | 'groq' | 'gemini' | 'openrouter' | 'cerebras' | 'cli_bridge';

export type EmbeddingProvider = 'workers_ai' | 'gemini' | 'voyage_ai';

export type Provider = TextProvider | EmbeddingProvider;

export type ReasoningEffort = 'auto' | 'low' | 'medium' | 'high';

export type FailureClass =
  | 'safety_refusal'
  | 'usage_retriable'
  | 'input_nonretriable'
  | 'provider_fatal';

export type ReasoningTier = Exclude<ReasoningEffort, 'auto'>;

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  role: ChatRole;
  content: string;
  name?: string;
}

export interface ModelCandidate {
  id: string;
  provider: TextProvider;
  model: string;
  reasoning: ReasoningTier;
  supportsStreaming: boolean;
  enabled: boolean;
  phase: 1 | 2;
  priority: number;
}

export interface ProviderLimitConfig {
  requestsPerDay: number;
}

export interface ModelStateSnapshot {
  key: string;
  attempts: number;
  successRate: number;
  avgLatencyMs: number;
  cooldownUntil: number;
  headroom: number;
  dailyUsed: number;
  dailyLimit: number;
  shortRetriableFailures: number;
}

export interface AttemptRecord {
  ts: number;
  latencyMs: number;
  success: boolean;
  failureClass?: FailureClass;
}

export interface GatewayMeta {
  provider: Provider;
  model: string;
  attempts: number;
  reasoning_effort: ReasoningEffort;
  request_id: string;
  project_id?: string;
}

export interface NormalizedChatRequest {
  model: string;
  messages: ChatMessage[];
  stream: boolean;
  temperature?: number;
  max_tokens?: number;
  reasoning_effort: ReasoningEffort;
}

export interface GatewayError {
  error: {
    message: string;
    type: string;
    code?: string;
  };
}

export interface Env {
  AI?: {
    run: (model: string, input: Record<string, unknown>) => Promise<unknown>;
  };
  HEALTH_DO: DurableObjectNamespace;
  RATE_LIMIT_DO: DurableObjectNamespace;
  HEALTH_KV: KVNamespace;
  GROQ_API_KEY?: string;
  GEMINI_API_KEY?: string;
  VOYAGE_API_KEY?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_WORKERS_AI_API_KEY?: string;
  CLI_BRIDGE_URL?: string;
  CLI_BRIDGE_PROVIDER?: string;
  OPENROUTER_API_KEY?: string;
  CEREBRAS_API_KEY?: string;
  MODEL_REGISTRY_JSON?: string;
  PROVIDER_LIMITS_JSON?: string;
  RATE_LIMIT_CONFIG_JSON?: string;
  DOCS_SITE_URL?: string;
  ENABLE_PHASE2?: string;
}
