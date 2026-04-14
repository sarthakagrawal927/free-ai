export type TextProvider = 'workers_ai' | 'groq' | 'gemini' | 'openrouter' | 'cerebras' | 'sambanova' | 'nvidia';

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

export interface ContentPartText {
  type: 'text';
  text: string;
}

export interface ContentPartImageUrl {
  type: 'image_url';
  image_url: { url: string; detail?: 'auto' | 'low' | 'high' };
}

export type ContentPart = ContentPartText | ContentPartImageUrl;

export interface ChatMessage {
  role: ChatRole;
  content: string | ContentPart[];
  name?: string;
}

export interface ModelCapabilities {
  toolCalling: boolean;
  jsonMode: boolean;
  vision: boolean;
  contextWindow: number;
  maxOutputTokens: number;
}

export interface ModelCandidate {
  id: string;
  provider: TextProvider;
  model: string;
  reasoning: ReasoningTier;
  supportsStreaming: boolean;
  enabled: boolean;
  priority: number;
  capabilities: ModelCapabilities;
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

export interface ToolFunction {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

export interface Tool {
  type: 'function';
  function: ToolFunction;
}

export interface ResponseFormat {
  type: 'text' | 'json_object';
}

export interface NormalizedChatRequest {
  model: string;
  messages: ChatMessage[];
  stream: boolean;
  temperature?: number;
  max_tokens?: number;
  reasoning_effort: ReasoningEffort;
  tools?: Tool[];
  tool_choice?: 'none' | 'auto' | 'required' | { type: 'function'; function: { name: string } };
  response_format?: ResponseFormat;
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
  OPENROUTER_API_KEY?: string;
  CEREBRAS_API_KEY?: string;
  SAMBANOVA_API_KEY?: string;
  NVIDIA_API_KEY?: string;
  MODEL_REGISTRY_JSON?: string;
  PROVIDER_LIMITS_JSON?: string;
  RATE_LIMIT_CONFIG_JSON?: string;
  DOCS_SITE_URL?: string;
}
