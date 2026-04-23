import { runOpenAICompatibleRequest } from './openai-compatible';
import type { ProviderCaller } from './types';

export const callCohere: ProviderCaller = async (input) => {
  if (!input.env.COHERE_API_KEY) {
    throw new Error('COHERE_API_KEY is not configured');
  }

  return runOpenAICompatibleRequest(input, {
    provider: 'cohere',
    baseURL: 'https://api.cohere.ai/compatibility/v1',
    apiKey: input.env.COHERE_API_KEY,
  });
};
