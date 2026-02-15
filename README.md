# Free AI Gateway (Cloudflare Worker)

OpenAI-compatible API gateway for text inference across free-tier providers.

## Endpoints

- `POST /v1/chat/completions`
- `GET /v1/models`
- `GET /health`
- `GET /openapi.json`
- `GET /docs`
- `GET /playground` (hidden, only when `PLAYGROUND_ENABLED=true`)

## Authentication

All `/v1/*`, `/openapi.json`, and `/docs` routes require:

```http
Authorization: Bearer <GATEWAY_API_KEY>
```

## Request Extension

`POST /v1/chat/completions` supports:

- `reasoning_effort`: `auto | low | medium | high`
- `prompt`: optional alias (converted into one `user` message)

## Response Extension

Non-stream responses include:

- `x_gateway`: provider/model/attempt metadata

## Local Dev

1. Install dependencies:

```bash
npm install
```

2. Configure secrets:

```bash
npx wrangler secret put GATEWAY_API_KEY
npx wrangler secret put GROQ_API_KEY
npx wrangler secret put GEMINI_API_KEY
# Optional phase-2
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put CEREBRAS_API_KEY
```

3. Update `wrangler.toml` KV IDs and run:

```bash
npm run dev
```

## Deploy

```bash
npm run deploy
```

## Test + Typecheck

```bash
npm run typecheck
npm test
```

## Example request

```bash
curl -X POST http://127.0.0.1:8787/v1/chat/completions \
  -H "Authorization: Bearer $GATEWAY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto",
    "prompt": "Explain edge runtimes in 3 bullets",
    "reasoning_effort": "medium",
    "stream": false
  }'
```
