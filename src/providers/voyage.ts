import { runOpenAICompatibleEmbeddingsRequest } from './openai-compatible';
import type { ProviderEmbeddingCaller } from './types';

export const callVoyageEmbeddings: ProviderEmbeddingCaller = async (input) => {
  if (!input.env.VOYAGE_API_KEY) {
    throw new Error('VOYAGE_API_KEY is not configured');
  }

  return runOpenAICompatibleEmbeddingsRequest(input, {
    provider: 'voyage_ai',
    baseURL: 'https://api.voyageai.com/v1',
    apiKey: input.env.VOYAGE_API_KEY,
  });
};
