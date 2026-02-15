import type { ChatMessage, Env, Provider } from '../types';

export interface ProviderCallInput {
  env: Env;
  provider: Provider;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream: boolean;
}

export interface ProviderCallResult {
  provider: Provider;
  model: string;
  stream: boolean;
  completion?: {
    id?: string;
    object?: string;
    created?: number;
    model?: string;
    choices?: Array<{
      index?: number;
      message?: {
        role?: string;
        content?: string | null;
      };
      finish_reason?: string | null;
      delta?: {
        content?: string | null;
      };
    }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };
  streamSource?: AsyncIterable<unknown>;
}

export type ProviderCaller = (input: ProviderCallInput) => Promise<ProviderCallResult>;
