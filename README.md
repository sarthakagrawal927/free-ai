# Free AI Gateway (Cloudflare Worker)

OpenAI-compatible API gateway for text inference with health-aware routing across free providers.

## What You Get

- OpenAI-style `POST /v1/chat/completions`
- OpenAI-style `POST /v1/responses` (non-stream)
- OpenAI-style `POST /v1/embeddings`
- Auto-routing by model health + `reasoning_effort`
- Provider adapters: Workers AI, Groq, Gemini, optional OpenRouter/Cerebras, optional `cli_bridge`
- Streaming and non-streaming responses
- Auth-protected API surface for server-to-server usage
- Usage dashboard (`/dashboard`) for live request analytics
- Raw request-log API (`GET /v1/requests`) for direct D1-backed inspection
- Hidden internal platform UI (`/playground`) for sandbox testing
- Public key-request intake endpoint (`POST /access/request-key`)

## Screenshots

Landing page:

![Platform Landing](docs/screenshots/platform-01-landing.png)

Live sandbox result:

![Platform Live Sandbox](docs/screenshots/platform-02-live-sandbox.png)

Key request submission:

![Platform Key Request](docs/screenshots/platform-03-key-request.png)

## API Surface

- `GET /` (landing page; send `Accept: application/json` for machine-readable metadata)
- `POST /v1/chat/completions` (protected)
- `POST /v1/responses` (protected, non-stream)
- `POST /v1/embeddings` (protected)
- `GET /v1/models` (protected)
- `GET /v1/analytics` (protected)
- `GET /v1/requests` (protected)
- `GET /health` (public)
- `GET /openapi.json` (protected)
- `GET /docs` (protected)
- `GET /dashboard` (public UI, reads protected APIs with your key)
- `GET /playground` (public only when `PLAYGROUND_ENABLED=true`)
- `POST /access/request-key` (public)

Note: `/v1/responses` currently supports non-stream mode. Use `/v1/chat/completions` for streaming.

## Auth

Protected routes require:

```http
Authorization: Bearer <GATEWAY_API_KEY>
```

## Request/Response Extensions

`POST /v1/chat/completions` supports:

- `reasoning_effort`: `auto | low | medium | high`
- `prompt`: alias when `messages` is omitted
- `project_id`: optional project tag (`[a-zA-Z0-9._:-]`, max 64 chars)

Responses include:

- `x_gateway`: provider/model/attempt/request metadata
- `x_gateway.project_id`: echoed when provided

You can also send project metadata via header:

- `x-gateway-project-id: <project-id>`

## Quickstart

1. Install:

```bash
npm install
```

2. Configure env:

```bash
cp .env.example .env
# fill values
```

3. Start local worker:

```bash
npm run dev:local
```

4. Optional platform UI:

```bash
PLAYGROUND_ENABLED=true npm run dev:local
```

Open: `http://127.0.0.1:8787/playground`

Usage dashboard: `http://127.0.0.1:8787/dashboard`

## Examples

Reusable SDK example projects live in `/examples`:

- Node.js: `/examples/node-openai-sdk`
- Python: `/examples/python-openai-sdk`

See `/examples/README.md` for quick run commands.

## Environment Variables

Use `.env.example` as the template.

Core:

- `GATEWAY_API_KEY`
- `PLAYGROUND_ENABLED`
- `ENABLE_PHASE2`
- `AUTO_ISSUE_KEYS` (`true` returns an API key immediately from `/access/request-key`)

Phase 1 providers:

- `GROQ_API_KEY`
- `GEMINI_API_KEY`
- `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_WORKERS_AI_API_KEY` (Workers AI REST fallback for local)
- `CLI_BRIDGE_URL` and optional `CLI_BRIDGE_PROVIDER`

Optional phase 2:

- `OPENROUTER_API_KEY`
- `CEREBRAS_API_KEY`

`npm run env:sync` copies allowed keys from `.env` into `.dev.vars` for Wrangler.

## cURL Examples

Set once:

```bash
export GATEWAY_URL="http://127.0.0.1:8787"
export GATEWAY_API_KEY="<your_gateway_key>"
```

OpenAI Node SDK:

```ts
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.GATEWAY_API_KEY,
  baseURL: 'https://free-ai-gateway.sarthakagrawal927.workers.dev/v1',
});

const response = await client.responses.create({
  model: 'auto',
  input: 'Write one line about edge AI',
});

console.log(response.output_text);
```

Non-stream chat (auto routing):

```bash
curl -sS "$GATEWAY_URL/v1/chat/completions" \
  -H "Authorization: Bearer $GATEWAY_API_KEY" \
  -H "Content-Type: application/json" \
  --data '{
    "model": "auto",
    "prompt": "Explain edge runtimes in 3 bullets",
    "reasoning_effort": "medium",
    "stream": false
  }'
```

Force Groq for debugging:

```bash
curl -sS "$GATEWAY_URL/v1/chat/completions" \
  -H "Authorization: Bearer $GATEWAY_API_KEY" \
  -H "Content-Type: application/json" \
  -H "x-gateway-force-provider: groq" \
  -H "x-gateway-project-id: project_analytics_api" \
  --data '{"prompt":"what color is panda","reasoning_effort":"low","stream":false}'
```

Responses API (OpenAI-compatible):

```bash
curl -sS "$GATEWAY_URL/v1/responses" \
  -H "Authorization: Bearer $GATEWAY_API_KEY" \
  -H "Content-Type: application/json" \
  --data '{
    "model": "auto",
    "input": "Write one sentence about routing",
    "stream": false
  }'
```

Embeddings API (OpenAI-compatible):

```bash
curl -sS "$GATEWAY_URL/v1/embeddings" \
  -H "Authorization: Bearer $GATEWAY_API_KEY" \
  -H "Content-Type: application/json" \
  -H "x-gateway-project-id: project_analytics_api" \
  --data '{
    "model": "auto",
    "input": ["what color is panda", "pandas are black and white"]
  }'
```

Streaming:

```bash
curl -N "$GATEWAY_URL/v1/chat/completions" \
  -H "Authorization: Bearer $GATEWAY_API_KEY" \
  -H "Content-Type: application/json" \
  --data '{"prompt":"Say hello in 5 languages","reasoning_effort":"low","stream":true}'
```

Models:

```bash
curl -sS "$GATEWAY_URL/v1/models" \
  -H "Authorization: Bearer $GATEWAY_API_KEY"
```

Analytics (last 7 days):

```bash
curl -sS "$GATEWAY_URL/v1/analytics" \
  -H "Authorization: Bearer $GATEWAY_API_KEY"
```

Analytics (single project + range):

```bash
curl -sS "$GATEWAY_URL/v1/analytics?project_id=simple_proj&date_from=2026-02-15&date_to=2026-02-21&limit=10" \
  -H "Authorization: Bearer $GATEWAY_API_KEY"
```

Raw request logs (directly from `gateway_requests`):

```bash
curl -sS "$GATEWAY_URL/v1/requests?date_from=2026-02-15&date_to=2026-02-21&limit=100&endpoint=chat.completions" \
  -H "Authorization: Bearer $GATEWAY_API_KEY"
```

Health:

```bash
curl -sS "$GATEWAY_URL/health"
```

Key request API:

```bash
curl -X POST "$GATEWAY_URL/access/request-key" \
  -H "Content-Type: application/json" \
  --data '{
    "name": "Jane Doe",
    "email": "jane@acme.dev",
    "company": "Acme Labs",
    "use_case": "Internal support copilot for our ops team",
    "intended_use": "internal",
    "expected_daily_requests": 1200
  }'
```

## Key Issuance Workflow

- Default (`AUTO_ISSUE_KEYS=false`):
- User submits `/access/request-key` form or API call.
- Gateway stores request metadata in D1 (`key_requests`) and returns `status: "queued"`.
- KV fallback is used only if D1 is unavailable.
- Operator reviews request and manually issues a key.

- Auto-issue mode (`AUTO_ISSUE_KEYS=true`):
- `/access/request-key` returns `status: "approved"` with `api_key` immediately.
- Gateway stores hashed key material in D1 (`api_keys.key_hash`).
- KV fallback is used only if D1 is unavailable.
- Client uses issued key in `Authorization: Bearer <key>`.

## Scripts

- `npm run dev` -> Wrangler remote dev
- `npm run dev:local` -> local worker with `.env` sync
- `npm run deploy:cloudflare` -> one-command Cloudflare deploy bootstrap + deploy
- `npm run deploy` -> deploy worker
- `npm run check` -> typecheck + unit tests
- `npm run test:e2e` -> mocked FE tests
- `npm run test:e2e:live:update` -> live snapshot baseline
- `npm run test:e2e:live` -> live snapshot verify

## Testing

Unit + typecheck:

```bash
npm run check
```

Mocked FE tests:

```bash
npm run test:e2e
```

Live Playwright snapshot tests (real providers, requires keys):

```bash
npm run test:e2e:live:update
npm run test:e2e:live
```

Python OpenAI SDK smoke test (deployed URL):

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install openai
python scripts/test_deployed_openai_sdk.py \
  --gateway-base-url https://free-ai-gateway.sarthakagrawal927.workers.dev
```

## Deploy

Recommended (one command):

```bash
npm run deploy:cloudflare
```

What this does:

- verifies Cloudflare auth (`wrangler whoami`)
- auto-resolves/creates `HEALTH_KV` + preview namespace
- auto-resolves/creates D1 database bound to `GATEWAY_DB`
- generates local `.wrangler.deploy.toml` with resolved KV/D1 IDs
- uploads secrets from `.env` in bulk
- applies D1 migrations from `/migrations`
- deploys and prints the `workers.dev` URL

Useful flags:

```bash
node scripts/deploy-cloudflare.mjs --prepare-only
node scripts/deploy-cloudflare.mjs --skip-secrets
```

Manual path:

1. Set secrets:

```bash
npx wrangler secret put GATEWAY_API_KEY
npx wrangler secret put GROQ_API_KEY
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put CLOUDFLARE_ACCOUNT_ID
npx wrangler secret put CLOUDFLARE_WORKERS_AI_API_KEY
# optional
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put CEREBRAS_API_KEY
```

2. Deploy:

```bash
npx wrangler d1 migrations apply GATEWAY_DB --remote
npm run deploy
```

## Notes

- Keep `PLAYGROUND_ENABLED=false` in production unless explicitly needed.
- Logs are metadata-oriented; raw prompt/completion storage is avoided by design.
- Embeddings route currently uses Gemini (`gemini-embedding-001`) and Workers AI (`@cf/baai/bge-base-en-v1.5`).
- Groq chat compatibility is enabled, but Groq embeddings are not wired because embeddings are not listed in the Groq API reference endpoints.
- If you pasted any real provider keys into chat, rotate them.

## Ranked Roadmap (Next)

1. Multimodal chat support in `/v1/chat/completions` (image/audio content arrays, OpenAI-compatible).
2. OpenAI model alias mapping (`gpt-*` names -> provider models) with explicit compatibility table.
3. Per-key and per-project quotas/rate limits (RPM/RPD/token budgets).
4. Key lifecycle APIs (create, rotate, revoke, expiry, scopes).
5. Provider circuit-breakers and automatic temporary model quarantine.
6. Contract tests against OpenAI SDKs (Node/Python/Go) for compatibility lock.
7. Prompt/response cache layer (hash-based, TTL, metadata-only logs).
8. Provider-normalized token usage accounting and cost tracking.
9. Alerting + observability (structured logs, error-rate alerts, latency SLOs).
10. Staging/prod deployment split with canary rollout and rollback.

## Free Multimodal Options (As Of 2026-02-21)

1. Gemini Developer API
- OpenAI-compatible multimodal chat examples show text + `image_url` inputs.
- Free tier exists; pricing tables mark some multimodal models (for example Gemini 3 Flash Preview) as free of charge on the free tier.
- Gemini 2.5 Flash free-tier rate limits are documented at `10 RPM`, `250,000 TPM`, `250 RPD` (check your project tier in AI Studio).
- Docs: [OpenAI compatibility](https://ai.google.dev/gemini-api/docs/openai), [Pricing](https://ai.google.dev/gemini-api/docs/pricing), [Rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)

2. Groq
- Vision is supported via OpenAI-style `chat.completions` with multimodal content (`type: image_url`) on Llama 4 Scout/Maverick models.
- Groq publishes Free Plan limits and includes Llama 4 vision models in those tables.
- Example published free-plan limits: `llama-4-scout-17b-16e-instruct` (`30 RPM`, `6,000 RPD`) and `llama-4-maverick-17b-128e-instruct` (`30 RPM`, `1,000 RPD`).
- Docs: [Images and Vision](https://console.groq.com/docs/vision), [Rate limits](https://console.groq.com/docs/rate-limits)

3. Cloudflare Workers AI
- Free allowance is 10,000 neurons/day, then paid usage above that threshold.
- Includes multimodal-capable models such as `@cf/meta/llama-3.2-11b-vision-instruct` (image reasoning/captioning/visual QA).
- Example cost on that model is documented as `$0.038 / 1,000 input tokens` and `$0.125 / 1,000 output tokens` once you exceed the daily free allowance.
- Docs: [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/), [Model catalog](https://developers.cloudflare.com/workers-ai/models/), [Llama 3.2 11B Vision](https://developers.cloudflare.com/workers-ai/models/llama-3.2-11b-vision-instruct/)
