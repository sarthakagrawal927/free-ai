#!/usr/bin/env python3
"""Smoke-test a deployed Free AI Gateway using the OpenAI Python SDK.

Usage:
  python3 scripts/test_deployed_openai_sdk.py \
    --gateway-base-url https://free-ai-gateway.sarthakagrawal927.workers.dev

If --api-key is omitted, the script can request one from /access/request-key.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any


@dataclass
class SmokeResult:
    ok: bool
    token_preview: str
    request_id: str | None
    chat_text: str
    responses_text: str
    stream_text: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Smoke-test deployed gateway with OpenAI SDK")
    parser.add_argument(
        "--gateway-base-url",
        default="https://free-ai-gateway.sarthakagrawal927.workers.dev",
        help="Gateway root URL (without /v1)",
    )
    parser.add_argument(
        "--api-base-url",
        default="",
        help="Override OpenAI SDK base URL (defaults to <gateway>/v1)",
    )
    parser.add_argument("--api-key", default="", help="Gateway API key (fagw_...) to use")
    parser.add_argument(
        "--request-key-if-missing",
        action="store_true",
        default=True,
        help="Request a key from /access/request-key when api key is missing (default: true)",
    )
    parser.add_argument(
        "--force-provider",
        default="",
        choices=["", "workers_ai", "groq", "gemini", "openrouter", "cerebras"],
        help="Optional x-gateway-force-provider header",
    )
    parser.add_argument(
        "--chat-prompt",
        default="Reply with exactly: PY_CHAT_OK",
        help="Prompt used for chat.completions test",
    )
    parser.add_argument(
        "--responses-input",
        default="Reply with exactly: PY_RESPONSES_OK",
        help="Input used for responses.create test",
    )
    parser.add_argument(
        "--stream-prompt",
        default="Reply with exactly: PY_STREAM_OK",
        help="Prompt used for streaming chat test",
    )
    parser.add_argument(
        "--timeout-seconds",
        type=float,
        default=45,
        help="OpenAI SDK timeout in seconds",
    )
    parser.add_argument(
        "--skip-stream",
        action="store_true",
        help="Skip stream test",
    )
    return parser.parse_args()


def request_gateway_key(gateway_base_url: str) -> tuple[str, str | None]:
    payload = {
        "name": "Gateway SDK Smoke Test",
        "email": f"sdk-smoke+{datetime.now(UTC).strftime('%Y%m%d%H%M%S')}@example.com",
        "company": "Free AI",
        "use_case": "Automated OpenAI SDK smoke testing against deployed gateway",
        "intended_use": "internal",
        "expected_daily_requests": 100,
    }

    req = urllib.request.Request(
        f"{gateway_base_url.rstrip('/')}/access/request-key",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            # Cloudflare may block the default Python-urllib signature (error 1010).
            "User-Agent": "curl/8.7.1",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            body = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Key request failed with HTTP {exc.code}: {body}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Key request network error: {exc}") from exc

    try:
        parsed = json.loads(body)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Key request returned non-JSON: {body}") from exc

    api_key = parsed.get("api_key")
    request_id = parsed.get("request_id")

    if not api_key:
        raise RuntimeError(
            "Key request did not return api_key. "
            f"Response: {json.dumps(parsed, ensure_ascii=True)}"
        )

    return str(api_key), str(request_id) if request_id else None


def build_extra_headers(force_provider: str) -> dict[str, str]:
    headers = {"x-gateway-project-id": "python_test_runner"}
    if force_provider:
        headers["x-gateway-force-provider"] = force_provider
    return headers


def run_smoke(args: argparse.Namespace) -> SmokeResult:
    try:
        from openai import OpenAI
    except Exception as exc:  # pragma: no cover - startup dependency guard
        raise RuntimeError(
            "Missing dependency 'openai'. Install with: python3 -m pip install openai"
        ) from exc

    gateway_base_url = args.gateway_base_url.rstrip("/")
    api_base_url = args.api_base_url.rstrip("/") if args.api_base_url else f"{gateway_base_url}/v1"

    api_key = args.api_key or os.environ.get("GATEWAY_API_KEY") or os.environ.get("OPENAI_API_KEY", "")
    request_id: str | None = None

    if not api_key:
        if not args.request_key_if_missing:
            raise RuntimeError("No api key provided and --request-key-if-missing is disabled")
        api_key, request_id = request_gateway_key(gateway_base_url)

    client = OpenAI(api_key=api_key, base_url=api_base_url, timeout=args.timeout_seconds)
    extra_headers = build_extra_headers(args.force_provider)

    chat = client.chat.completions.create(
        model="auto",
        messages=[{"role": "user", "content": args.chat_prompt}],
        extra_headers=extra_headers,
    )
    chat_text = (chat.choices[0].message.content or "").strip() if chat.choices else ""

    responses = client.responses.create(
        model="auto",
        input=args.responses_input,
        extra_headers=extra_headers,
    )
    responses_text = (responses.output_text or "").strip()

    stream_text = ""
    if not args.skip_stream:
        chunks: list[str] = []
        stream = client.chat.completions.create(
            model="auto",
            messages=[{"role": "user", "content": args.stream_prompt}],
            stream=True,
            extra_headers=extra_headers,
        )
        for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta
            if delta and delta.content:
                chunks.append(delta.content)
        stream_text = "".join(chunks).strip()

    ok = bool(chat_text and responses_text and (stream_text or args.skip_stream))
    token_preview = f"{api_key[:12]}..." if len(api_key) >= 12 else "***"

    return SmokeResult(
        ok=ok,
        token_preview=token_preview,
        request_id=request_id,
        chat_text=chat_text,
        responses_text=responses_text,
        stream_text=stream_text,
    )


def main() -> int:
    args = parse_args()
    try:
        result = run_smoke(args)
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, indent=2))
        return 1

    print(
        json.dumps(
            {
                "ok": result.ok,
                "token_preview": result.token_preview,
                "request_id": result.request_id,
                "chat_text": result.chat_text,
                "responses_text": result.responses_text,
                "stream_text": result.stream_text,
            },
            indent=2,
            ensure_ascii=True,
        )
    )
    return 0 if result.ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
