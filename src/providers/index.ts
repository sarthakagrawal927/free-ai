import { callCerebras } from './cerebras';
import { callGemini } from './gemini';
import { callGroq } from './groq';
import { callOpenRouter } from './openrouter';
import type { ProviderCaller } from './types';
import { callWorkersAi } from './workers-ai';

export const providerCallers: Record<string, ProviderCaller> = {
  workers_ai: callWorkersAi,
  groq: callGroq,
  gemini: callGemini,
  openrouter: callOpenRouter,
  cerebras: callCerebras,
};
