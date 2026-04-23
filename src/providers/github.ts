import { runOpenAICompatibleRequest } from './openai-compatible';
import type { ProviderCaller } from './types';

export const callGithubModels: ProviderCaller = async (input) => {
  if (!input.env.GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN is not configured');
  }

  return runOpenAICompatibleRequest(input, {
    provider: 'github_models',
    baseURL: 'https://models.github.ai/inference',
    apiKey: input.env.GITHUB_TOKEN,
  });
};
