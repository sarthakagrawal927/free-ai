import { runOpenAICompatibleRequest } from './openai-compatible';
import type { ProviderCaller } from './types';

export const callPollinations: ProviderCaller = async (input) => {
  return runOpenAICompatibleRequest(input, {
    provider: 'pollinations',
    baseURL: 'https://text.pollinations.ai/openai',
    apiKey: 'anonymous',
    defaultHeaders: { referer: 'https://free-ai-gateway.workers.dev' },
  });
};
