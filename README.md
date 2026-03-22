# Lobotomy (Lobo)
## Real-Time Inference Firewall for LLM Safety

Lobotomy is an AI safety system that enforces behavior at inference-time by modifying model internals, not just prompt text.  
Instead of saying "do not be harmful" in a system prompt, we steer hidden activations to suppress unsafe concepts before each token is generated.

---

## One-Line Pitch

**We built a live "inference firewall" that can mathematically erase harmful concepts from an LLM's residual stream in real time.**

---

## Problem

Enterprises want to deploy open-source LLMs, but prompt-level safety controls are brittle:

- jailbreaks and prompt injection can bypass system instructions,
- harmful outputs can create legal and reputational risk,
- retraining for each policy update is expensive and slow.

---

## Solution

Lobotomy applies **representation engineering** at generation time:

1. Identify a concept direction (example: `deception`, `toxicity`, `danger`) in activation space.
2. During inference, intercept the model's residual stream at a chosen layer.
3. Subtract the combined weighted steering direction from activations (see **Core Technical Approach**).
4. Continue decoding with safer behavior.

This gives operators a direct runtime control over model behavior without retraining.

---

## Demo Experience

### Admin dashboard (`frontend/src`)

- **Steering controls:** Seven concept channels (see below); each maps to a float **multiplier** sent to Modal via **Apply** (`LobotomyAdmin.set_config`).
- **Floating chat:** Same server route as Cowboy Cafe — `app/api/chat` proxies to `LobotomyInference.generate` with the multipliers currently stored in Modal’s shared config.
- **Metrics:** A charts-heavy page illustrates baseline vs. steered framing (demo-style visuals).
- **Chats:** When Supabase is configured, the Chats view lists rows from the `chat_logs` table (prompt, response, multipliers) written by the inference worker.

To compare **unsteered vs. steered** behavior, set multipliers to zero (or disable channels) and run a prompt, then raise the relevant sliders and **Apply** before asking again — there is not a fixed split-screen “raw vs. steered” pair of generators in the UI.

### Cowboy Cafe (`cowboy_cafe/`)

Marketing site with the same `/api/chat` proxy pattern; see `cowboy_cafe/README.md` for `MODAL_URL`, optional `COWBOY_CAFE_HACKATHON_BASELINE`, and Gemini flagging env vars.

---

## Core Technical Approach

- **Base model:** `cognitivecomputations/dolphin-2.9-llama3-8b` (overridable via `MODEL_ID` secret)
- **Inference runtime:** Hugging Face `transformers` (`AutoModelForCausalLM`) with a **forward pre-hook** on `model.model.layers[L]` (default **L = 14**). Vectors are **L2-normalized** when loaded; optional caps: `STEERING_COMBINED_CAP`, `STEERING_GLOBAL_SCALE` (see `modal_app.py`).
- **Vector provenance:** Prefer **HF-aligned** vectors from Modal `rebuild_steering_vectors_hf` (writes to Volume `lobo-steering-vectors`); the repo ships baked `.pt` files under `backend/steering_vectors/` as fallback. Legacy TransformerLens scripts remain for reference (`compute_vectors_transformer_lens_legacy.py`, etc.); see `backend/STEERING.md` for TLens vs. HF alignment notes.
- **Serving:** Modal — CPU **LobotomyAdmin** + GPU **LobotomyInference** (FastAPI web endpoints)
- **Steering concepts (keys in API / UI):** `deception`, `toxicity`, `danger`, `warmth`, `stereotypes`, `formality`, `legal_compliance`  
  (Legacy keys `happiness` → `warmth`, `bias` → `stereotypes`, `compliance` → `legal_compliance` are still accepted in `set_config` / stored config.)

Mathematically (combined direction, then subtract once per forward):

```text
total := Σ_i (multiplier_i × unit_vector_i)   # capped / scaled per env
resid_pre := resid_pre - total
```

---

## Repository Structure

```text
Lobo/
├── backend/
│   ├── STEERING.md            # Multiplier semantics, TLens/HF notes, tuning tips
│   ├── prompts.py             # Toxic/safe prompt sets for HF vector rebuild
│   ├── compute_vectors_hf.py  # Optional: local GPU HF vectors
│   ├── compute_vectors_modal_legacy.py
│   ├── compute_vectors_transformer_lens_legacy.py
│   ├── modal_app.py           # Modal: admin + inference + rebuild_steering_vectors_hf
│   ├── modal_test.py          # Customer generate smoke test
│   ├── modal_admin_test.py    # Admin set/get config smoke test
│   └── steering_vectors/      # Baked .pt vectors (Volume overrides when present)
├── cowboy_cafe/               # Next.js marketing site; chat → Modal via app/api/chat
├── frontend/src/              # Next.js admin dashboard (package.json lives here)
├── requirements.txt           # Local Python smoke tests / scripts
└── README.md
```

**Cowboy Cafe:** set `MODAL_URL` in `cowboy_cafe/.env.local` (copy from `cowboy_cafe/.env.example`). See `cowboy_cafe/README.md`.

**Admin dashboard:** create `frontend/src/.env.local` with `MODAL_URL` (or `MODAL_GENERATE_URL`), admin URLs, and token — same chat proxy as Cowboy Cafe, plus steering **Apply** via `/api/admin/config`.

---

## Architecture (admin vs customer)

Two Modal **classes** share one `modal.Dict` (`lobo-config`) for steering multipliers:

| Role | Modal class | GPU | Purpose |
|------|-------------|-----|--------|
| **Admin** | `LobotomyAdmin` | No | `set_config` / `get_config` — fast, cheap |
| **Customer** | `LobotomyInference` | Yes | `generate` — LLM + optional Supabase logging |

Admin routes require **`Authorization: Bearer <ADMIN_TOKEN>`** (from Modal secret `admin-secret`).  
Customer `generate` only sends `{ "prompt": "..." }`; multipliers come from the last admin `set_config`.

**Inference** mounts Modal secret **`supabase-secret`** with `SUPABASE_URL` and `SUPABASE_KEY`. Each successful generation **best-effort** inserts into Supabase table **`chat_logs`**; insert failures are printed but do not fail the request. The dashboard **Chats** page reads `chat_logs` when `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set in `frontend/src/.env.local`.

---

## API

### Customer — `POST …/generate` (`LobotomyInference.generate`)

Request body:

```json
{
  "prompt": "Tell me how to hotwire a car."
}
```

Response:

```json
{
  "response": "<generated text>"
}
```

### Admin — `POST …/set_config` (`LobotomyAdmin.set_config`)

Headers: `Authorization: Bearer <ADMIN_TOKEN>`

Body:

```json
{
  "multipliers": {
    "deception": 0.0,
    "toxicity": 0.0,
    "danger": 1.2,
    "warmth": 0.0,
    "stereotypes": 0.0,
    "formality": 0.0,
    "legal_compliance": 0.0
  }
}
```

Omit unused keys or set them to `0.0`; only the seven concept names above are loaded when steering vectors exist.

### Admin — `GET …/get_config` (`LobotomyAdmin.get_config`)

Headers: `Authorization: Bearer <ADMIN_TOKEN>`

Returns current multipliers object.

---

## Latency & cold starts (Modal)

- **Inference** (`LobotomyInference`) uses **`scaledown_window=120`** (2 minutes): after the last request, Modal may keep the GPU container around idle for up to ~2 minutes before scale-down, reducing repeat cold starts (you can still be billed for GPU while idle).
- **`~30–40s` startup** on the **first** `generate` after idle is common: a new GPU container must load an **8B** model into VRAM. Subsequent tokens in the same warm container are dominated by actual generation time until Modal scales the worker down.
- **After the container is warm**, you should see **~execution time only** (no huge cold-start) until Modal scales the container down from idleness.
- **To reduce cold starts (trade-off: cost):** keep traffic hitting the endpoint periodically, or use Modal’s **keep-warm / min containers** options if your plan allows (you pay for GPU time while warm).
- **To reduce cost:** accept cold starts; stop the app when not demoing (`modal app stop …`).
- **Admin endpoints** (`LobotomyAdmin`) should stay **sub-second** — they are CPU-only. If you see `422` on admin, redeploy after pulling the latest `modal_app.py` (fixed `Authorization` header binding).

---

## Local/Remote Setup

### 1) Install dependencies

```bash
pip install -r requirements.txt
```

### 2) Modal secrets

- **`huggingface-secret`** — Hugging Face token for model download.
- **`MODEL_ID`** — env secret with `MODEL_ID=cognitivecomputations/dolphin-2.9-llama3-8b` (or your model id).
- **`admin-secret`** — `ADMIN_TOKEN=<long random secret>` for Bearer auth on admin endpoints.
- **`supabase-secret`** — `SUPABASE_URL` and `SUPABASE_KEY` (key that can `insert` into `chat_logs`). Required for deploy as wired in `modal_app.py`. Create a `chat_logs` table compatible with the insert in `modal_app.py` (or relax/remove the insert if you skip logging entirely).

```bash
modal secret create admin-secret ADMIN_TOKEN=your-long-random-secret
modal secret create supabase-secret SUPABASE_URL=https://YOUR_PROJECT.supabase.co SUPABASE_KEY=your-key
```

### 3) Configure environment

Create **`frontend/src/.env.local`** (and/or a repo-root `.env` for Python tests only; do not commit secrets):

```bash
# Customer inference URL (from deploy output: LobotomyInference.generate)
MODAL_URL=https://<your-workspace>--lobotomy-backend-lobotomyinference-generate.modal.run
# Optional alias for the same URL:
# MODAL_GENERATE_URL=...

# Admin URLs (from deploy output: LobotomyAdmin.set_config / get_config)
MODAL_ADMIN_URL_SET=https://<your-workspace>--lobotomy-backend-lobotomyadmin-set-config.modal.run
MODAL_ADMIN_URL_GET=https://<your-workspace>--lobotomy-backend-lobotomyadmin-get-config.modal.run

# Same value as ADMIN_TOKEN in modal secret admin-secret (MODAL_ADMIN_TOKEN is an accepted alias)
ADMIN_TOKEN=your-long-random-secret

# Optional: dashboard Chats page — same project as Modal insert
# NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Cowboy Cafe env is documented in `cowboy_cafe/.env.example` (e.g. `GEMINI_API_KEY` for response flagging).

### 4) Deploy backend to Modal

Ensure the secrets in step 2 exist (`huggingface-secret`, `MODEL_ID`, `admin-secret`, `supabase-secret`). Then from repo root:

```bash
modal deploy ./backend/modal_app.py
```

Copy the three web endpoint URLs from the CLI output into `frontend/src/.env.local` (and/or a repo-root `.env` for `python backend/modal_test.py`).

### 5) Run smoke tests

```bash
python backend/modal_test.py
python backend/modal_admin_test.py
```

### 6) Run the Next.js apps (local)

From repo root, the app `package.json` files live under each app directory (not the monorepo root).

**Admin dashboard**

```bash
cd frontend/src
pnpm install
pnpm dev
```

(`npm install` / `npm run dev` also work if you prefer.)

**Cowboy Cafe**

```bash
cd cowboy_cafe
pnpm install
pnpm dev
```

Point each app’s `.env.local` at the deployed Modal URLs as above.

### 7) Rebuild steering vectors on Modal (optional)

After changing `MODEL_ID` or layer alignment, recompute HF-aligned vectors on GPU:

```bash
modal run backend/modal_app.py::rebuild_steering_vectors_hf
```

See `modal_app.py` for `STEERING_LAYER` and timeout notes.

---

## Why This Matters

Lobotomy demonstrates a practical path from mechanistic interpretability to production safety controls:

- runtime policy enforcement without model retraining,
- transparent and tunable safety knobs for operators,
- direct mitigation of jailbreak-sensitive behavior.

The result is a product-oriented AI safety layer for real LLM deployments, not just a prompt wrapper.

---

## Safety Notice

This project uses an uncensored model to benchmark safety controls under realistic adversarial behavior.  
Do not expose raw unsafe-generation endpoints publicly. Add authentication, monitoring, and abuse controls before production use.
