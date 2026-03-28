# Security Audit — free-ai
**Date**: 2026-03-28 | **Status**: Paused

## Secrets in Git History
None found. No `.env`, `.pem`, `.key`, or service-account files were ever committed.

## Credentials on Disk
**CRITICAL**: `.env` contains 6 live API keys (Cloudflare, Groq, Gemini, Voyage, OpenRouter, Cerebras).
`.gitignore` correctly excludes `.env` files — keys are not in the repo.
**Action required**: Rotate all keys if this machine is shared or compromised.

## Deployment
- Cloudflare Workers via `wrangler.toml` (`workers_dev = true`).
- KV namespace IDs and Durable Object bindings are present (non-secret, acceptable).
- No Vercel, Netlify, or Firebase deployment configs found.

## Code Security
- No CORS misconfigurations (`Access-Control-Allow-Origin: *`) detected.
- No `dangerouslySetInnerHTML` usage found.
- No hardcoded API keys, tokens, or passwords in source files.

## Action Items
- [ ] Rotate all 6 API keys in `.env` if project is truly paused (reduce blast radius)
- [ ] Confirm Cloudflare Worker is undeployed/disabled if not actively serving traffic
- [ ] Delete `.env` from disk if keys are rotated and project won't resume soon
