import { runOpenAICompatibleRequest } from './openai-compatible';
import type { ProviderCaller } from './types';

export const callOpenRouter: ProviderCaller = async (input) => {
  if (!input.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  return runOpenAICompatibleRequest(input, {
    provider: 'openrouter',
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: input.env.OPENROUTER_API_KEY,
    defaultHeaders: {
      'HTTP-Referer': 'https://free-ai-gateway.internal',
      'X-Title': 'free-ai-gateway',
    },
  });
};
