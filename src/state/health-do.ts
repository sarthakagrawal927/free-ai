import type { AttemptRecord, FailureClass, ModelStateSnapshot, ProviderLimitConfig } from '../types';

interface HealthDoEnv {
  HEALTH_KV?: KVNamespace;
}

interface ModelState {
  history: AttemptRecord[];
  cooldownUntil: number;
  dayKey: string;
  dailyUsed: number;
}

type RoundRobinMap = Record<string, number>;

const MODEL_PREFIX = 'm:';
const ROUND_ROBIN_STORAGE_KEY = 'round-robin';
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

function storageKey(modelKey: string): string {
  return `${MODEL_PREFIX}${modelKey}`;
}

export class HealthStateDO {
  constructor(
    private readonly ctx: DurableObjectState,
    private readonly env: HealthDoEnv,
  ) {}

  private async loadModel(key: string): Promise<ModelState | undefined> {
    return this.ctx.storage.get<ModelState>(storageKey(key));
  }

  private async saveModel(key: string, state: ModelState): Promise<void> {
    await this.ctx.storage.put(storageKey(key), state);
  }

  private async loadAllModels(): Promise<Map<string, ModelState>> {
    const entries = await this.ctx.storage.list<ModelState>({ prefix: MODEL_PREFIX });
    const result = new Map<string, ModelState>();
    for (const [k, v] of entries) {
      result.set(k.slice(MODEL_PREFIX.length), v);
    }
    return result;
  }

  private async loadRoundRobinState(): Promise<RoundRobinMap> {
    return (await this.ctx.storage.get<RoundRobinMap>(ROUND_ROBIN_STORAGE_KEY)) ?? {};
  }

  private async saveRoundRobinState(state: RoundRobinMap): Promise<void> {
    await this.ctx.storage.put(ROUND_ROBIN_STORAGE_KEY, state);
  }

  private resetIfNeeded(modelState: ModelState, now: number): void {
    const today = dayKey(now);
    if (modelState.dayKey !== today) {
      modelState.dayKey = today;
      modelState.dailyUsed = 0;
    }
  }

  private async persistSnapshot(allModels: Map<string, ModelState>): Promise<void> {
    if (!this.env.HEALTH_KV || typeof this.env.HEALTH_KV.put !== 'function') {
      return;
    }

    const payload = Array.from(allModels.entries()).map(([key, modelState]) => ({
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

      const modelState = (await this.loadModel(body.key)) ?? emptyModelState(body.now);
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

      await this.saveModel(body.key, modelState);

      const allModels = await this.loadAllModels();
      await this.persistSnapshot(allModels);

      return json({ ok: true });
    }

    if (path === '/lookup') {
      const body = (await request.json()) as {
        keys: string[];
        limits: Record<string, ProviderLimitConfig>;
        now: number;
      };

      const snapshots: ModelStateSnapshot[] = [];
      for (const key of body.keys) {
        const modelState = (await this.loadModel(key)) ?? emptyModelState(body.now);
        this.resetIfNeeded(modelState, body.now);
        await this.saveModel(key, modelState);
        snapshots.push(toSnapshot(key, modelState, body.limits[key], body.now));
      }

      return json({ snapshots });
    }

    if (path === '/snapshot') {
      const now = Date.now();
      const allModels = await this.loadAllModels();
      const snapshots = Array.from(allModels.entries()).map(([key, modelState]) =>
        toSnapshot(key, modelState, undefined, now),
      );
      return json({ snapshots });
    }

    if (path === '/round-robin-next') {
      const body = (await request.json()) as {
        key?: string;
        size?: number;
      };

      const key = String(body.key ?? '').trim();
      const size = Math.max(1, Math.floor(Number(body.size ?? 0)));
      if (!key || size <= 1) {
        return json({ offset: 0 });
      }

      const roundRobinState = await this.loadRoundRobinState();
      const current = roundRobinState[key] ?? 0;
      const offset = ((current % size) + size) % size;
      roundRobinState[key] = (offset + 1) % size;
      await this.saveRoundRobinState(roundRobinState);

      return json({ offset });
    }

    return json({ error: 'Not found' }, 404);
  }
}
