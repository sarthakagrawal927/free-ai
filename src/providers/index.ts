import { callCerebras } from './cerebras';
import { callCliBridge } from './cli-bridge';
import { callGemini, callGeminiEmbeddings } from './gemini';
import { callGroq } from './groq';
import { callOpenRouter } from './openrouter';
import type { ProviderCaller, ProviderEmbeddingCaller } from './types';
import { callWorkersAi, callWorkersAiEmbeddings } from './workers-ai';

export const providerCallers: Record<string, ProviderCaller> = {
  workers_ai: callWorkersAi,
  groq: callGroq,
  gemini: callGemini,
  openrouter: callOpenRouter,
  cerebras: callCerebras,
  cli_bridge: callCliBridge,
};

export const providerEmbeddingCallers: Partial<Record<string, ProviderEmbeddingCaller>> = {
  workers_ai: callWorkersAiEmbeddings,
  gemini: callGeminiEmbeddings,
};
