# Node.js Example (OpenAI SDK)

Simple text-response example against the deployed gateway.

## Run

```bash
cd examples/node-openai-sdk
cp .env.example .env
npm install
npm start
```

If `GATEWAY_API_KEY` is empty, the script requests one from `/access/request-key`.
If that endpoint is rate-limited, set `GATEWAY_API_KEY` in `.env` and run again.

## Output

The script prints JSON with:

- `responses_text`
- `chat_text`
- `stream_text`
- `token_preview`
