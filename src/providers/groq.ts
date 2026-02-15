import { runOpenAICompatibleRequest } from './openai-compatible';
import type { ProviderCaller } from './types';

export const callGroq: ProviderCaller = async (input) => {
  if (!input.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  return runOpenAICompatibleRequest(input, {
    provider: 'groq',
    baseURL: 'https://api.groq.com/openai/v1',
    apiKey: input.env.GROQ_API_KEY,
  });
};
