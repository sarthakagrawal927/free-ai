import { getTierOrder } from '../config';
import type { ChatMessage, ContentPart, ModelCandidate, ModelStateSnapshot, ReasoningEffort, ReasoningTier, ResponseFormat, Tool } from '../types';

export interface RequiredCapabilities {
  toolCalling?: boolean;
  jsonMode?: boolean;
  vision?: boolean;
  minContextWindow?: number;
}

function messagesContainImages(messages: ChatMessage[]): boolean {
  return messages.some((msg) => {
    if (!Array.isArray(msg.content)) {
      return false;
    }
    return (msg.content as ContentPart[]).some((part) => part.type === 'image_url');
  });
}

function estimateTokenCount(messages: ChatMessage[]): number {
  let chars = 0;
  for (const msg of messages) {
    if (typeof msg.content === 'string') {
      chars += msg.content.length;
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content as ContentPart[]) {
        if (part.type === 'text') {
          chars += part.text.length;
        } else if (part.type === 'image_url') {
          chars += 1000; // rough estimate for image tokens
        }
      }
    }
  }
  // ~4 chars per token + overhead per message
  return Math.ceil(chars / 4) + messages.length * 4;
}

export function deriveRequiredCapabilities(options: {
  tools?: Tool[];
  response_format?: ResponseFormat;
  messages?: ChatMessage[];
}): RequiredCapabilities {
  const estimatedTokens = options.messages ? estimateTokenCount(options.messages) : 0;
  // Add 20% buffer so the model has room for output
  const minContext = estimatedTokens > 0 ? Math.ceil(estimatedTokens * 1.2) : undefined;

  return {
    toolCalling: options.tools && options.tools.length > 0 ? true : undefined,
    jsonMode: options.response_format?.type === 'json_object' ? true : undefined,
    vision: options.messages && messagesContainImages(options.messages) ? true : undefined,
    minContextWindow: minContext,
  };
}

const clamp = (value: number, min = 0, max = 1): number => Math.max(min, Math.min(max, value));

function reasoningFit(requested: ReasoningEffort, candidateTier: ReasoningTier): number {
  if (requested === 'auto') {
    return candidateTier === 'medium' ? 1 : 0.8;
  }

  if (requested === candidateTier) {
    return 1;
  }

  if (requested === 'high' && candidateTier === 'medium') {
    return 0.85;
  }

  if (requested === 'low' && candidateTier === 'medium') {
    return 0.85;
  }

  return 0.65;
}

export function computeScore(
  requested: ReasoningEffort,
  candidate: ModelCandidate,
  state: ModelStateSnapshot | undefined,
): number {
  const successRate = state ? state.successRate : 0.5;
  const headroom = state ? state.headroom : 1;
  const avgLatencyMs = state ? state.avgLatencyMs : 1500;
  const latencyScore = clamp(1 - avgLatencyMs / 8000);
  const fit = reasoningFit(requested, candidate.reasoning);

  const score =
    successRate * 0.6 +
    headroom * 0.2 +
    latencyScore * 0.15 +
    fit * 0.05 +
    candidate.priority * 0.02;

  return score;
}

interface SelectOptions {
  requestedReasoning: ReasoningEffort;
  stream: boolean;
  now: number;
  modelOverride?: string;
  excludedKeys?: Set<string>;
  requiredCapabilities?: RequiredCapabilities;
}

export function selectCandidates(
  registry: ModelCandidate[],
  stateMap: Map<string, ModelStateSnapshot>,
  options: SelectOptions,
): ModelCandidate[] {
  const order = getTierOrder(options.requestedReasoning);
  const excluded = options.excludedKeys ?? new Set<string>();

  const caps = options.requiredCapabilities;

  const available = registry.filter((candidate) => {
    if (options.stream && !candidate.supportsStreaming) {
      return false;
    }

    if (options.modelOverride && candidate.model !== options.modelOverride && candidate.id !== options.modelOverride) {
      return false;
    }

    if (caps) {
      if (caps.toolCalling && !candidate.capabilities.toolCalling) {
        return false;
      }
      if (caps.jsonMode && !candidate.capabilities.jsonMode) {
        return false;
      }
      if (caps.vision && !candidate.capabilities.vision) {
        return false;
      }
      if (caps.minContextWindow && candidate.capabilities.contextWindow < caps.minContextWindow) {
        return false;
      }
    }

    const key = `${candidate.provider}:${candidate.model}`;
    if (excluded.has(key)) {
      return false;
    }

    const state = stateMap.get(key);
    if (state && state.cooldownUntil > options.now) {
      return false;
    }

    if (state && state.headroom <= 0) {
      return false;
    }

    return true;
  });

  const ranked: Array<{ candidate: ModelCandidate; score: number; tierIndex: number }> = [];

  for (const candidate of available) {
    const state = stateMap.get(`${candidate.provider}:${candidate.model}`);
    const tierIndex = order.indexOf(candidate.reasoning);
    if (tierIndex === -1) {
      continue;
    }

    ranked.push({
      candidate,
      score: computeScore(options.requestedReasoning, candidate, state),
      tierIndex,
    });
  }

  ranked.sort((a, b) => {
    if (a.tierIndex !== b.tierIndex) {
      return a.tierIndex - b.tierIndex;
    }

    return b.score - a.score;
  });

  return ranked.map((item) => item.candidate);
}
