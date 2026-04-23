import { runOpenAICompatibleRequest } from './openai-compatible';
import type { ProviderCaller } from './types';

export const callMistral: ProviderCaller = async (input) => {
  if (!input.env.MISTRAL_API_KEY) {
    throw new Error('MISTRAL_API_KEY is not configured');
  }

  return runOpenAICompatibleRequest(input, {
    provider: 'mistral',
    baseURL: 'https://api.mistral.ai/v1',
    apiKey: input.env.MISTRAL_API_KEY,
  });
};
