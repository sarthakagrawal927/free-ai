#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from datetime import UTC, datetime
from pathlib import Path

from openai import OpenAI


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue

        index = line.find("=")
        if index == -1:
            continue

        key = line[:index].strip()
        value = line[index + 1 :].strip()
        if (value.startswith('"') and value.endswith('"')) or (
            value.startswith("'") and value.endswith("'")
        ):
            value = value[1:-1]

        os.environ.setdefault(key, value)


def preview_token(token: str) -> str:
    return f"{token[:12]}..." if len(token) >= 12 else "***"


def request_gateway_key(base_url: str) -> tuple[str, str | None]:
    payload = {
        "name": "Python SDK Example",
        "email": f"python-example+{datetime.now(UTC).strftime('%Y%m%d%H%M%S')}@example.com",
        "company": "Free AI",
        "use_case": "Python OpenAI SDK example bootstrap",
        "intended_use": "internal",
        "expected_daily_requests": 100,
    }

    req = urllib.request.Request(
        f"{base_url}/access/request-key",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "curl/8.7.1",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            body = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"Key request failed ({exc.code}): {body}. "
            "Set GATEWAY_API_KEY in .env to skip key request."
        ) from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Key request network error: {exc}") from exc

    parsed = json.loads(body)
    api_key = parsed.get("api_key")
    if not api_key:
        raise RuntimeError(
            f"Key request did not return api_key: {json.dumps(parsed)}. "
            "Set GATEWAY_API_KEY in .env to skip key request."
        )

    return str(api_key), str(parsed.get("request_id")) if parsed.get("request_id") else None


def main() -> int:
    load_dotenv(Path.cwd() / ".env")

    base_url = os.environ.get("GATEWAY_BASE_URL", "https://free-ai-gateway.sarthakagrawal927.workers.dev").rstrip("/")
    model = os.environ.get("MODEL", "auto")
    responses_input = os.environ.get("RESPONSES_INPUT", "Reply with exactly: PY_RESPONSES_OK")
    chat_prompt = os.environ.get("CHAT_PROMPT", "Reply with exactly: PY_CHAT_OK")
    stream_prompt = os.environ.get("STREAM_PROMPT", "Reply with exactly: PY_STREAM_OK")
    force_provider = os.environ.get("FORCE_PROVIDER", "")

    api_key = os.environ.get("GATEWAY_API_KEY", "")
    request_id: str | None = None

    if not api_key:
        api_key, request_id = request_gateway_key(base_url)

    client = OpenAI(api_key=api_key, base_url=f"{base_url}/v1", timeout=45)
    extra_headers = {"x-gateway-force-provider": force_provider} if force_provider else None

    responses_result = client.responses.create(
        model=model,
        input=responses_input,
        stream=False,
        extra_headers=extra_headers,
    )

    chat_result = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": chat_prompt}],
        extra_headers=extra_headers,
    )

    stream = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": stream_prompt}],
        stream=True,
        extra_headers=extra_headers,
    )

    stream_text = ""
    for chunk in stream:
        if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
            stream_text += chunk.choices[0].delta.content

    print(
        json.dumps(
            {
                "ok": True,
                "gateway_base_url": base_url,
                "token_preview": preview_token(api_key),
                "request_id": request_id,
                "responses_text": responses_result.output_text,
                "chat_text": chat_result.choices[0].message.content if chat_result.choices else "",
                "stream_text": stream_text,
            },
            indent=2,
        )
    )

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, indent=2))
        raise SystemExit(1)
