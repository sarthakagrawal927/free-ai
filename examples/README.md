# Examples

This folder contains minimal client projects that use your deployed gateway as an OpenAI-compatible host.

## Node.js (OpenAI SDK)

- Path: `examples/node-openai-sdk`
- Run: `npm install && npm start`

## Python (OpenAI SDK)

- Path: `examples/python-openai-sdk`
- Run: `python -m pip install -r requirements.txt && python main.py`

Both examples:

- default to `https://free-ai-gateway.sarthakagrawal927.workers.dev`
- use `baseURL=<gateway>/v1`
- can auto-request a key from `/access/request-key` when no key is provided
- print simple text response outputs from `responses`, `chat.completions`, and streaming chat
