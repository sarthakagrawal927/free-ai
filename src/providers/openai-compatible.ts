import OpenAI from 'openai';
import type { Provider } from '../types';
import type { ProviderCallInput, ProviderCallResult } from './types';

interface OpenAICompatibleConfig {
  provider: Provider;
  baseURL: string;
  apiKey: string;
  defaultHeaders?: Record<string, string>;
}

function createClient(config: OpenAICompatibleConfig): OpenAI {
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    defaultHeaders: config.defaultHeaders,
    dangerouslyAllowBrowser: true,
  });
}

export async function runOpenAICompatibleRequest(
  input: ProviderCallInput,
  config: OpenAICompatibleConfig,
): Promise<ProviderCallResult> {
  const client = createClient(config);

  if (input.stream) {
    const streamBody = {
      model: input.model,
      messages: input.messages,
      temperature: input.temperature,
      max_tokens: input.max_tokens,
      stream: true as const,
    };

    const stream = (await client.chat.completions.create(streamBody as never)) as unknown as AsyncIterable<unknown>;
    return {
      provider: config.provider,
      model: input.model,
      stream: true,
      streamSource: stream,
    };
  }

  const completionBody = {
    model: input.model,
    messages: input.messages,
    temperature: input.temperature,
    max_tokens: input.max_tokens,
    stream: false as const,
  };

  const completion = (await client.chat.completions.create(
    completionBody as never,
  )) as ProviderCallResult['completion'];
  return {
    provider: config.provider,
    model: input.model,
    stream: false,
    completion,
  };
}
