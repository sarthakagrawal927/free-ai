import { getTierOrder } from '../config';
import type { ModelCandidate, ModelStateSnapshot, ReasoningEffort, ReasoningTier } from '../types';

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
}

export function selectCandidates(
  registry: ModelCandidate[],
  stateMap: Map<string, ModelStateSnapshot>,
  options: SelectOptions,
): ModelCandidate[] {
  const order = getTierOrder(options.requestedReasoning);
  const excluded = options.excludedKeys ?? new Set<string>();

  const available = registry.filter((candidate) => {
    if (options.stream && !candidate.supportsStreaming) {
      return false;
    }

    if (options.modelOverride && candidate.model !== options.modelOverride && candidate.id !== options.modelOverride) {
      return false;
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
