import { runOpenAICompatibleRequest } from './openai-compatible';
import type { ProviderCaller } from './types';

export const callGemini: ProviderCaller = async (input) => {
  if (!input.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  return runOpenAICompatibleRequest(input, {
    provider: 'gemini',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    apiKey: input.env.GEMINI_API_KEY,
  });
};
