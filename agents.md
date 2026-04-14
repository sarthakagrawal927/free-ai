# Free AI Gateway

OpenAI-compatible API gateway that routes requests across free LLM providers with health-aware model selection. Deployed as a Cloudflare Worker. Part of the SaaS Maker ecosystem (`@sass-maker/ai-gateway`).

## Tech Stack

- **Runtime**: Cloudflare Workers
- **Framework**: Hono (with `@hono/zod-openapi` for typed routes + Swagger UI)
- **State**: Durable Objects (SQLite-backed) for health tracking + IP rate limiting; KV for health snapshot cache
- **Validation**: Zod v4
- **Playground**: React 19 + Zustand + React Query (Vite-built SPA served from worker)
- **Docs site**: Astro + Starlight (`site/` dir, separate package)
- **Testing**: Vitest (unit), Playwright (e2e for playground + live smoke tests)
- **Language**: TypeScript (strict, ES2022)

## Architecture

```
src/
  index.ts          # Main Hono app: all route handlers
  config.ts         # Model registry (30+ models), provider limits, rate limit config
  types.ts          # Shared types (Env, ModelCandidate, Provider, etc.)
  mod.ts            # npm entry point (re-exports app, DOs, types)
  providers/
    index.ts        # Maps provider name -> caller function
    groq.ts         # Groq API caller
    gemini.ts       # Gemini API caller (chat + embeddings)
    workers-ai.ts   # Cloudflare Workers AI caller
    openrouter.ts   # OpenRouter API caller
    cerebras.ts     # Cerebras API caller
    voyage.ts       # Voyage AI embeddings caller
    openai-compatible.ts # Shared OpenAI-format caller
  router/
    select-model.ts # Scoring algorithm: selects best model based on success rate, headroom, latency
    classify-error.ts # Classifies errors into failure classes
  state/
    health-do.ts    # HealthStateDO: per-model attempt history, cooldowns, daily usage
    ip-rate-limit-do.ts # IpRateLimitDO: token-bucket rate limiter per IP
    client.ts       # Client functions to call DOs from worker code
  utils/
    request.ts      # Request normalization
    sse.ts          # SSE stream helpers
playground/         # React playground SPA
site/               # Astro Starlight docs site
test/               # Unit tests
e2e/                # Playwright tests (playground)
e2e-live/           # Playwright tests (deployed worker)
```

### Request Flow

1. IP rate limit check via `IpRateLimitDO`
2. Parse + validate request body (Zod)
3. Build model registry from config (filtered by available API keys)
4. Fetch health snapshots from `HealthStateDO`
5. `selectCandidates()` scores and ranks models
6. Round-robin within top-tier candidates
7. Retry loop with `p-retry`: call provider, record success/failure, on retriable failure try next candidate
8. Return OpenAI-format response with `x_gateway` metadata

### Providers (7 text, 3 embedding)

Workers AI, Groq, Gemini, OpenRouter, Cerebras, SambaNova, NVIDIA, Voyage AI (embeddings)

## Key Conventions

- **Naming**: snake_case for provider names, camelCase for everything else
- **Error handling**: All provider errors classified into 4 failure classes; only `usage_retriable` triggers retry
- **OpenAPI**: Routes defined with `@hono/zod-openapi` createRoute pattern; Swagger UI at `/docs`
- **State**: Single global `HealthStateDO` instance; per-IP `IpRateLimitDO` instances
- **Monolithic index.ts**: All routes live in `src/index.ts`

## Commands

```bash
pnpm dev                        # Dev with wrangler (remote mode)
pnpm dev:local                  # Dev with wrangler (local mode)
pnpm test                       # Unit tests (vitest)
pnpm run typecheck              # TypeScript check
pnpm test:e2e                   # Playwright tests (playground)
pnpm test:e2e:live              # Playwright tests (deployed worker)
pnpm deploy                     # Deploy to Cloudflare Workers
pnpm run build:playground       # Build playground SPA
```

## Environment Variables

```bash
# Required for non-Workers-AI providers
GROQ_API_KEY=                   # Groq free tier
GEMINI_API_KEY=                 # Gemini free tier
VOYAGE_API_KEY=                 # Voyage AI embeddings

# Optional
OPENROUTER_API_KEY=
CEREBRAS_API_KEY=
CLOUDFLARE_ACCOUNT_ID=          # Workers AI REST fallback (local dev)
CLOUDFLARE_WORKERS_AI_API_KEY=
PLAYGROUND_ENABLED=false
```

## Current State

**Done:**
- Full OpenAI-compatible API (chat completions, embeddings, responses API)
- 30+ models across 6 providers
- Health-aware model selection with scoring, cooldowns, daily limits
- SSE streaming support
- IP rate limiting (token bucket via Durable Objects)
- OpenAPI spec + Swagger UI
- React playground SPA
- Unit + e2e + live smoke tests
- Astro docs site

**Not done:**
- `index.ts` is monolithic (~55KB) -- could be split
- No auth system (gateway is fully open)
- No per-user usage tracking
- No persistent logging/analytics
