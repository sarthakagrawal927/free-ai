import { runOpenAICompatibleRequest } from './openai-compatible';
import type { ProviderCaller } from './types';

export const callSambanova: ProviderCaller = async (input) => {
  if (!input.env.SAMBANOVA_API_KEY) {
    throw new Error('SAMBANOVA_API_KEY is not configured');
  }

  return runOpenAICompatibleRequest(input, {
    provider: 'sambanova',
    baseURL: 'https://api.sambanova.ai/v1',
    apiKey: input.env.SAMBANOVA_API_KEY,
  });
};
