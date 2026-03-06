# Free AI Gateway

OpenAI-compatible API gateway that routes requests across free LLM providers with health-aware model selection. Powered by [SaaS Maker](https://sassmaker.com).

## Authentication

No API key required. The gateway is open — pass any value (or nothing) as the Bearer token.

## Chat Models (22 models, 5 providers)

Use `model: "auto"` to let the gateway pick the best available model, or specify an exact model ID.

### High Reasoning

| Model ID | Provider | Actual Model | Daily Limit |
|----------|----------|-------------|-------------|
| `workers-ai-llama-3.3-70b` | Workers AI | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 200 |
| `workers-ai-deepseek-r1-32b` | Workers AI | `@cf/deepseek-ai/deepseek-r1-distill-qwen-32b` | 200 |
| `groq-deepseek-r1-70b` | Groq | `deepseek-r1-distill-llama-70b` | 200 |
| `groq-llama-70b` | Groq | `llama-3.3-70b-versatile` | 300 |
| `groq-qwen-qwq-32b` | Groq | `qwen-qwq-32b` | 300 |
| `groq-llama3-70b` | Groq | `llama3-70b-8192` | 300 |
| `gemini-1.5-pro` | Gemini | `gemini-1.5-pro` | 50 |

### Medium Reasoning

| Model ID | Provider | Actual Model | Daily Limit |
|----------|----------|-------------|-------------|
| `gemini-2.0-flash` | Gemini | `gemini-2.0-flash` | 1000 |
| `workers-ai-llama-8b` | Workers AI | `@cf/meta/llama-3.1-8b-instruct` | 500 |
| `workers-ai-qwen-14b` | Workers AI | `@cf/qwen/qwen1.5-14b-chat-awq` | 300 |
| `workers-ai-gemma-7b` | Workers AI | `@cf/google/gemma-7b-it-lora` | 500 |
| `groq-gemma2-9b` | Groq | `gemma2-9b-it` | 1000 |
| `groq-mixtral-8x7b` | Groq | `mixtral-8x7b-32768` | 500 |
| `gemini-1.5-flash` | Gemini | `gemini-1.5-flash` | 1500 |

### Low Reasoning (fastest)

| Model ID | Provider | Actual Model | Daily Limit |
|----------|----------|-------------|-------------|
| `groq-llama-8b` | Groq | `llama-3.1-8b-instant` | 1500 |
| `groq-llama3-8b` | Groq | `llama3-8b-8192` | 1500 |
| `gemini-2.0-flash-lite` | Gemini | `gemini-2.0-flash-lite` | 1500 |
| `gemini-1.5-flash-8b` | Gemini | `gemini-1.5-flash-8b` | 1500 |
| `workers-ai-mistral-7b` | Workers AI | `@cf/mistral/mistral-7b-instruct-v0.1` | 500 |
| `workers-ai-llama-3b` | Workers AI | `@cf/meta/llama-3.2-3b-instruct` | 800 |
| `workers-ai-llama-1b` | Workers AI | `@cf/meta/llama-3.2-1b-instruct` | 1000 |
| `workers-ai-phi-2` | Workers AI | `@cf/microsoft/phi-2` | 800 |

### Phase 2 (needs API keys + ENABLE_PHASE2=true)

| Model ID | Provider | Actual Model | Tier |
|----------|----------|-------------|------|
| `openrouter-llama-70b-free` | OpenRouter | `meta-llama/llama-3.3-70b-instruct:free` | high |
| `openrouter-qwen-72b-free` | OpenRouter | `qwen/qwen-2.5-72b-instruct:free` | high |
| `openrouter-deepseek-r1-free` | OpenRouter | `deepseek/deepseek-r1:free` | high |
| `openrouter-mistral-7b-free` | OpenRouter | `mistralai/mistral-7b-instruct:free` | low |
| `cerebras-llama-70b` | Cerebras | `llama-3.3-70b` | high |
| `cerebras-qwen-32b` | Cerebras | `qwen-3-32b` | high |
| `cerebras-llama-8b` | Cerebras | `llama3.1-8b` | low |

## Embedding Models (6 models, 3 providers)

Embeddings require an explicit model — `auto` is not supported.

| Model ID | Provider | Notes |
|----------|----------|-------|
| `gemini-embedding-001` | Gemini | Default, highest priority |
| `voyage-3.5-lite` | Voyage AI | Fallback #1 |
| `voyage-3-lite` | Voyage AI | Fallback #2 |
| `@cf/baai/bge-large-en-v1.5` | Workers AI | 768-dim, largest |
| `@cf/baai/bge-base-en-v1.5` | Workers AI | 768-dim, balanced |
| `@cf/baai/bge-small-en-v1.5` | Workers AI | 384-dim, fastest |

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
pnpm install
cp .env.example .env  # fill provider keys
pnpm dev:local
```

## Deploy

```bash
pnpm wrangler deploy
```
