# Free AI Gateway

OpenAI-compatible API gateway that routes requests across free LLM providers with health-aware model selection.

## Authentication

No API key required. The gateway is open — pass any value (or nothing) as the Bearer token.

## Chat Models

Use `model: "auto"` to let the gateway pick the best available model, or specify an exact model ID.

| Model ID | Provider | Reasoning Tier | Streaming |
|----------|----------|---------------|-----------|
| `@cf/meta/llama-3.1-8b-instruct` | Workers AI | medium | yes |
| `@cf/mistral/mistral-7b-instruct-v0.1` | Workers AI | low | yes |
| `llama-3.1-8b-instant` | Groq | low | yes |
| `llama-3.3-70b-versatile` | Groq | high | yes |
| `gemini-2.0-flash-lite` | Gemini | low | yes |
| `gemini-2.0-flash` | Gemini | medium | yes |

### Phase 2 (disabled by default)

| Model ID | Provider | Reasoning Tier | Streaming |
|----------|----------|---------------|-----------|
| `openrouter/free` | OpenRouter | low | yes |
| `qwen-3-32b` | Cerebras | high | yes |

## Embedding Models

Embeddings require an explicit model — `auto` is not supported.

| Model ID | Provider |
|----------|----------|
| `gemini-embedding-001` | Gemini |
| `voyage-3.5-lite` | Voyage AI |
| `@cf/baai/bge-base-en-v1.5` | Workers AI |

**Aliases** — these map to `gemini-embedding-001`:
- `text-embedding-3-small`
- `text-embedding-3-large`
- `text-embedding-004`

## API Endpoints

Base URL: `https://free-ai-gateway.sarthakagrawal927.workers.dev`

### Chat Completions

```
POST /v1/chat/completions
```

```bash
curl $GATEWAY_URL/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": false
  }'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model` | string | No | Model ID or `auto` (default) |
| `messages` | array | Yes* | OpenAI-format messages |
| `prompt` | string | Yes* | Shorthand when `messages` is omitted |
| `stream` | boolean | No | Enable SSE streaming (default false) |
| `temperature` | number | No | 0–2 |
| `max_tokens` | number | No | 1–8192 |
| `reasoning_effort` | string | No | `auto`, `low`, `medium`, `high` |

*Either `messages` or `prompt` is required.

### Responses API

```
POST /v1/responses
```

OpenAI Responses API compatible. Non-streaming only. Internally proxies to `/v1/chat/completions`.

### Embeddings

```
POST /v1/embeddings
```

```bash
curl $GATEWAY_URL/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-embedding-001",
    "input": ["text to embed"]
  }'
```

### Models

```
GET /v1/models
```

Lists all available models with health status and routing metadata.

### Health

```
GET /health
```

Returns model health snapshots.

## Response Extensions

All responses include an `x_gateway` field:

```json
{
  "x_gateway": {
    "provider": "groq",
    "model": "llama-3.3-70b-versatile",
    "attempts": 1,
    "reasoning_effort": "auto",
    "request_id": "abc123"
  }
}
```

## SDK Usage

Works with the standard OpenAI SDK:

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'anything',
  baseURL: 'https://free-ai-gateway.sarthakagrawal927.workers.dev/v1',
});

const response = await client.chat.completions.create({
  model: 'auto',
  messages: [{ role: 'user', content: 'Hello' }],
});
```

## Provider Routing

The gateway uses health-aware routing:
- Tracks success rate, latency, and daily usage per model
- Respects `reasoning_effort` to prefer models matching the requested tier
- Automatically retries on failure with next-best model
- Force a specific provider with `X-Gateway-Force-Provider: groq` header
- Force a specific model with `X-Gateway-Force-Model: llama-3.3-70b-versatile` header

## Rate Limits

IP-based rate limiting: 10 requests burst, ~20 requests/minute sustained.

## Development

```bash
npm install
cp .env.example .env  # fill provider keys
npm run dev:local
```

## Deploy

```bash
npm run deploy:cloudflare
```
