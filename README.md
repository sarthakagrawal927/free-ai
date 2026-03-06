# Free AI Gateway

OpenAI-compatible API gateway that routes requests across free LLM providers with health-aware model selection.

## Getting a Key

API keys are issued through [SaaS Maker](https://app.sassmaker.com). Sign up, create a project, and configure the AI Gateway to get your key.

## Available Models

The gateway auto-routes across these free providers:

| Provider | Models | Notes |
|----------|--------|-------|
| **Groq** | Llama 4 Scout, Llama 4 Maverick, Gemma 2 | Fast inference |
| **Gemini** | Gemini 2.5 Flash, Gemini 3 Flash Preview | Multimodal, multilingual |
| **Workers AI** | Llama 3.x, Qwen, Mistral, BGE embeddings | Cloudflare edge |
| **Voyage AI** | voyage-3.5-lite | Embeddings |
| **OpenRouter** | Various (when configured) | Fallback |
| **Cerebras** | Various (when configured) | Fast inference |

Use `model: "auto"` to let the gateway pick the best available model, or specify a model name directly.

## API Endpoints

Base URL: `https://free-ai-gateway.sarthakagrawal927.workers.dev`

### Chat Completions

```
POST /v1/chat/completions
```

```bash
curl -X POST $GATEWAY_URL/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": false
  }'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model` | string | No | Model name or `auto` (default) |
| `messages` | array | Yes* | OpenAI-format messages |
| `prompt` | string | Yes* | Shorthand when `messages` is omitted |
| `stream` | boolean | No | Enable SSE streaming (default false) |
| `temperature` | number | No | 0-2 |
| `max_tokens` | number | No | 1-8192 |
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
curl -X POST $GATEWAY_URL/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "model": "voyage-3.5-lite",
    "input": ["text to embed"]
  }'
```

Requires an explicit `model` — `auto` is not supported for embeddings.

### Models

```
GET /v1/models
```

Lists all available models with health status.

### Health

```
GET /health
```

Public endpoint. Returns model health snapshots.

## Response Extensions

All responses include an `x_gateway` field:

```json
{
  "x_gateway": {
    "provider": "groq",
    "model": "llama-4-scout-17b-16e-instruct",
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
  apiKey: 'pk_your_saasmaker_key',
  baseURL: 'https://free-ai-gateway.sarthakagrawal927.workers.dev/v1',
});

const response = await client.chat.completions.create({
  model: 'auto',
  messages: [{ role: 'user', content: 'Hello' }],
});
```

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
