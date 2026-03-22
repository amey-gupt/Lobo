#!/usr/bin/env python3
"""
Smoke test: Modal generate + Supabase chat_logs visibility.

Usage (from repo root):
  pip install requests python-dotenv supabase
  python backend/smoke_chat_logs.py

Loads `.env` then `frontend/src/.env.local` if present (does not print secrets).
"""
from __future__ import annotations

import os
import sys

import requests
from dotenv import load_dotenv

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main() -> int:
    load_dotenv(os.path.join(_REPO_ROOT, ".env"))
    load_dotenv(os.path.join(_REPO_ROOT, "frontend", "src", ".env.local"))

    modal_url = (os.environ.get("MODAL_URL") or "").strip()
    if not modal_url:
        print("FAIL: MODAL_URL not set (repo .env or env)")
        return 1

    prompt = "Smoke test: reply with exactly the word OK and nothing else."
    print("1) POST LobotomyInference.generate …")
    try:
        r = requests.post(
            modal_url,
            json={"prompt": prompt},
            timeout=180,
        )
    except requests.RequestException as e:
        print(f"FAIL: request error: {e}")
        return 1

    if r.status_code != 200:
        print(f"FAIL: Modal HTTP {r.status_code}")
        print(r.text[:500])
        return 1

    body = r.json()
    reply = (body.get("response") or "")[:200]
    print(f"   Modal OK. Response preview ({len(reply)} chars): {reply!r}")

    sb_url = (os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or "").strip()
    sb_key = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    if not sb_url or not sb_key:
        print(
            "2) SKIP: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — cannot verify DB."
        )
        return 0

    try:
        from supabase import create_client
    except ImportError:
        print("2) SKIP: supabase package not installed (`pip install supabase`)")
        return 0

    print("2) Query chat_logs (latest 3 rows, service role) …")
    sb = create_client(sb_url, sb_key)
    res = (
        sb.table("chat_logs")
        .select("id,prompt,response,multipliers,created_at,gemini_flagged_at")
        .order("created_at", desc=True)
        .limit(3)
        .execute()
    )
    rows = getattr(res, "data", None) or []
    if not rows:
        print("   WARN: chat_logs is empty — inserts may be failing or RLS blocked anon reads.")
        print("   (This script uses service role; empty table means nothing was inserted.)")
        return 2

    latest = rows[0]
    pid = latest.get("id")
    p = latest.get("prompt") or ""
    resp = latest.get("response") or ""
    print(f"   Latest row id={pid} prompt_len={len(p)} response_len={len(resp)}")
    if len(p) < 1 or len(resp) < 1:
        print("   FAIL: latest row missing prompt or response text")
        return 3

    # Heuristic: our smoke prompt should appear in the newest row if insert ran for this request.
    if prompt[:40] in p or "Smoke test" in p:
        print("   OK: Latest row matches this smoke prompt (insert path likely working).")
    else:
        print(
            "   WARN: Latest row is not this smoke test — older traffic or insert lag; check timestamps."
        )

    gf = latest.get("gemini_flagged_at")
    print(f"   gemini_flagged_at: {gf!r} (None until Modal evaluator finishes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
