interface BucketState {
  tokens: number;
  lastRefillAt: number;
}

interface RateLimitBody {
  key: string;
  now: number;
  cost: number;
  capacity: number;
  refillPerSecond: number;
}

const json = (value: unknown, status = 200): Response =>
  Response.json(value, {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });

export class IpRateLimitDO {
  constructor(private readonly ctx: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname !== '/consume') {
      return json({ error: 'Not found' }, 404);
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    const body = (await request.json()) as RateLimitBody;
    const storageKey = `bucket:${body.key}`;

    const stored = await this.ctx.storage.get<BucketState>(storageKey);
    const bucket: BucketState = stored ?? {
      tokens: body.capacity,
      lastRefillAt: body.now,
    };

    const elapsedSec = Math.max(0, (body.now - bucket.lastRefillAt) / 1000);
    bucket.tokens = Math.min(body.capacity, bucket.tokens + elapsedSec * body.refillPerSecond);
    bucket.lastRefillAt = body.now;

    if (bucket.tokens < body.cost) {
      const deficit = body.cost - bucket.tokens;
      const retryAfter = body.refillPerSecond > 0 ? Math.ceil(deficit / body.refillPerSecond) : 60;
      await this.ctx.storage.put(storageKey, bucket);
      return json(
        {
          allowed: false,
          remaining: Math.floor(bucket.tokens),
          retryAfter,
        },
        429,
      );
    }

    bucket.tokens -= body.cost;
    await this.ctx.storage.put(storageKey, bucket);

    return json({
      allowed: true,
      remaining: Math.floor(bucket.tokens),
      retryAfter: 0,
    });
  }
}
