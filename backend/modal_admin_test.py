"""Smoke test for CPU-only admin endpoints (set/get multipliers). Requires admin-secret on Modal."""

import os

import requests
from dotenv import load_dotenv

load_dotenv()

admin_url_set = os.getenv("MODAL_ADMIN_URL_SET")  # POST set_config
admin_url_get = os.getenv("MODAL_ADMIN_URL_GET")  # GET get_config
token = os.getenv("ADMIN_TOKEN")

if not all([admin_url_set, admin_url_get, token]):
    print("Set MODAL_ADMIN_URL_SET, MODAL_ADMIN_URL_GET, and ADMIN_TOKEN in .env")
    raise SystemExit(1)

headers = {"Authorization": f"Bearer {token}"}

r = requests.post(
    admin_url_set,
    json={"multipliers": {"danger": 0.0, "deception": 0.0}},
    headers=headers,
    timeout=30,
)
print("set_config:", r.status_code, r.text)

r2 = requests.get(admin_url_get, headers=headers, timeout=30)
print("get_config:", r2.status_code, r2.text)
