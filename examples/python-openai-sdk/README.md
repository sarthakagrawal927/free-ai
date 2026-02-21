# Python Example (OpenAI SDK)

Simple text-response example against the deployed gateway.

## Run

```bash
cd examples/python-openai-sdk
cp .env.example .env
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python main.py
```

If `GATEWAY_API_KEY` is empty, the script requests one from `/access/request-key`.
If that endpoint is rate-limited, set `GATEWAY_API_KEY` in `.env` and run again.

## Output

The script prints JSON with:

- `responses_text`
- `chat_text`
- `stream_text`
- `token_preview`
