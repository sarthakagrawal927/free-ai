import { runOpenAICompatibleRequest } from './openai-compatible';
import type { ProviderCaller } from './types';

export const callNvidia: ProviderCaller = async (input) => {
  if (!input.env.NVIDIA_API_KEY) {
    throw new Error('NVIDIA_API_KEY is not configured');
  }

  return runOpenAICompatibleRequest(input, {
    provider: 'nvidia',
    baseURL: 'https://integrate.api.nvidia.com/v1',
    apiKey: input.env.NVIDIA_API_KEY,
  });
};
