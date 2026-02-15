import { runOpenAICompatibleRequest } from './openai-compatible';
import type { ProviderCaller } from './types';

export const callCerebras: ProviderCaller = async (input) => {
  if (!input.env.CEREBRAS_API_KEY) {
    throw new Error('CEREBRAS_API_KEY is not configured');
  }

  return runOpenAICompatibleRequest(input, {
    provider: 'cerebras',
    baseURL: 'https://api.cerebras.ai/v1',
    apiKey: input.env.CEREBRAS_API_KEY,
  });
};
