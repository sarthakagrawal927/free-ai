import { callCerebras } from './cerebras';
import { callCliBridge } from './cli-bridge';
import { callGemini, callGeminiEmbeddings } from './gemini';
import { callGroq } from './groq';
import { callOpenRouter } from './openrouter';
import type { ProviderCaller, ProviderEmbeddingCaller } from './types';
import { callVoyageEmbeddings } from './voyage';
import { callWorkersAi, callWorkersAiEmbeddings } from './workers-ai';
import type { EmbeddingProvider, TextProvider } from '../types';

export const providerCallers: Record<TextProvider, ProviderCaller> = {
  workers_ai: callWorkersAi,
  groq: callGroq,
  gemini: callGemini,
  openrouter: callOpenRouter,
  cerebras: callCerebras,
  cli_bridge: callCliBridge,
};

export const providerEmbeddingCallers: Record<EmbeddingProvider, ProviderEmbeddingCaller> = {
  workers_ai: callWorkersAiEmbeddings,
  gemini: callGeminiEmbeddings,
  voyage_ai: callVoyageEmbeddings,
};
