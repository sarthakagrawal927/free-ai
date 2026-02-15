import type { AttemptRecord, FailureClass, ModelStateSnapshot, ProviderLimitConfig } from '../types';

interface HealthDoEnv {
  HEALTH_KV: KVNamespace;
}

interface ModelState {
  history: AttemptRecord[];
  cooldownUntil: number;
  dayKey: string;
  dailyUsed: number;
}

type StateMap = Record<string, ModelState>;

const STORAGE_KEY = 'state';
const HISTORY_LIMIT = 100;
const SHORT_WINDOW = 10;
const SHORT_FAILURE_THRESHOLD = 7;
const COOL_DOWN_MS = 120_000;
const RETRIABLE_BASE_COOLDOWN_MS = 45_000;

const json = (value: unknown, status = 200): Response =>
  Response.json(value, {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });

const dayKey = (timestamp: number): string => new Date(timestamp).toISOString().slice(0, 10);

function emptyModelState(now: number): ModelState {
  return {
    history: [],
    cooldownUntil: 0,
    dayKey: dayKey(now),
    dailyUsed: 0,
  };
}

function toSnapshot(
  key: string,
  state: ModelState,
  limitConfig: ProviderLimitConfig | undefined,
  now: number,
): ModelStateSnapshot {
  const attempts = state.history.length;
  const successful = state.history.filter((item) => item.success).length;
  const successRate = attempts === 0 ? 0.5 : successful / attempts;
  const avgLatencyMs =
    attempts === 0 ? 1500 : state.history.reduce((sum, item) => sum + item.latencyMs, 0) / attempts;

  const recent = state.history.slice(-SHORT_WINDOW);
  const shortRetriableFailures = recent.filter(
    (item) => !item.success && item.failureClass === 'usage_retriable',
  ).length;

  const dailyLimit = limitConfig?.requestsPerDay ?? 1;
  const headroom = Math.max(0, 1 - state.dailyUsed / dailyLimit);

  return {
    key,
    attempts,
    successRate,
    avgLatencyMs,
    cooldownUntil: Math.max(state.cooldownUntil, now > state.cooldownUntil ? 0 : state.cooldownUntil),
    headroom,
    dailyUsed: state.dailyUsed,
    dailyLimit,
    shortRetriableFailures,
  };
}

export class HealthStateDO {
  constructor(
    private readonly ctx: DurableObjectState,
    private readonly env: HealthDoEnv,
  ) {}

  private async loadState(): Promise<StateMap> {
    return (await this.ctx.storage.get<StateMap>(STORAGE_KEY)) ?? {};
  }

  private async saveState(state: StateMap): Promise<void> {
    await this.ctx.storage.put(STORAGE_KEY, state);
  }

  private resetIfNeeded(modelState: ModelState, now: number): void {
    const today = dayKey(now);
    if (modelState.dayKey !== today) {
      modelState.dayKey = today;
      modelState.dailyUsed = 0;
    }
  }

  private async persistSnapshot(state: StateMap): Promise<void> {
    const payload = Object.entries(state).map(([key, modelState]) => ({
      key,
      attempts: modelState.history.length,
      cooldownUntil: modelState.cooldownUntil,
      dayKey: modelState.dayKey,
      dailyUsed: modelState.dailyUsed,
    }));

    await this.env.HEALTH_KV.put('gateway-health-snapshot', JSON.stringify(payload), {
      expirationTtl: 300,
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method !== 'POST' && path !== '/snapshot') {
      return json({ error: 'Method not allowed' }, 405);
    }

    if (path === '/record') {
      const body = (await request.json()) as {
        key: string;
        success: boolean;
        latencyMs: number;
        failureClass?: FailureClass;
        now: number;
      };

      const state = await this.loadState();
      const modelState = state[body.key] ?? emptyModelState(body.now);
      this.resetIfNeeded(modelState, body.now);

      modelState.history.push({
        ts: body.now,
        success: body.success,
        latencyMs: body.latencyMs,
        failureClass: body.failureClass,
      });

      if (modelState.history.length > HISTORY_LIMIT) {
        modelState.history = modelState.history.slice(-HISTORY_LIMIT);
      }

      if (body.success) {
        modelState.dailyUsed += 1;
      }

      const recent = modelState.history.slice(-SHORT_WINDOW);
      const shortRetriableFailures = recent.filter(
        (attempt) => !attempt.success && attempt.failureClass === 'usage_retriable',
      ).length;

      if (!body.success && body.failureClass === 'usage_retriable') {
        modelState.cooldownUntil = Math.max(modelState.cooldownUntil, body.now + RETRIABLE_BASE_COOLDOWN_MS);
      }

      if (shortRetriableFailures >= SHORT_FAILURE_THRESHOLD) {
        modelState.cooldownUntil = Math.max(modelState.cooldownUntil, body.now + COOL_DOWN_MS);
      }

      state[body.key] = modelState;
      await this.saveState(state);
      await this.persistSnapshot(state);

      return json({ ok: true });
    }

    if (path === '/lookup') {
      const body = (await request.json()) as {
        keys: string[];
        limits: Record<string, ProviderLimitConfig>;
        now: number;
      };

      const state = await this.loadState();
      const snapshots = body.keys.map((key) => {
        const modelState = state[key] ?? emptyModelState(body.now);
        this.resetIfNeeded(modelState, body.now);
        state[key] = modelState;
        return toSnapshot(key, modelState, body.limits[key], body.now);
      });

      await this.saveState(state);
      return json({ snapshots });
    }

    if (path === '/snapshot') {
      const now = Date.now();
      const state = await this.loadState();
      const snapshots = Object.entries(state).map(([key, modelState]) =>
        toSnapshot(key, modelState, undefined, now),
      );
      return json({ snapshots });
    }

    return json({ error: 'Not found' }, 404);
  }
}
