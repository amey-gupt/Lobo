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
3. Subtract `multiplier × steering_vector` from activations.
4. Continue decoding with safer behavior.

This gives operators a direct runtime control over model behavior without retraining.

---

## Demo Experience

### Dual-Pane Chat

- **Left pane:** Raw model output (`multiplier = 0`).
- **Right pane:** Steered output (`multiplier > 0`).

Same prompt, same model, different internal control.  
Judges can instantly compare unsafe vs. steered behavior.

### Brain Scanner

A live visualization shows targeted activation values while the model is generating.  
As the safety slider increases, the concept signal attenuates in real time.

---

## Core Technical Approach

- **Base model:** `cognitivecomputations/dolphin-2.9-llama3-8b`
- **Interpretability runtime:** TransformerLens (`HookedTransformer`)
- **Serving:** Modal + FastAPI endpoint on GPU
- **Control primitive:** residual-stream hook at configurable layer (default layer 14)
- **Steering method:** additive inverse vector projection

Mathematically:

```text
resid_pre := resid_pre - Σ_i (multiplier_i * steering_vector_i)
```

---

## Repository Structure

```text
Lobo/
├── backend/
│   ├── modal_app.py       # Modal: CPU admin API + GPU inference (shared config dict)
│   ├── modal_test.py      # Customer generate smoke test
│   ├── modal_admin_test.py  # Admin set/get config smoke test
│   └── steering_vectors/  # Concept vectors (.pt) loaded at runtime
├── cowboy_cafe/           # Next.js marketing site; chat → Modal via app/api/chat
├── requirements.txt
└── README.md
```

**Cowboy Cafe chat:** set `MODAL_URL` in `cowboy_cafe/.env.local` to your `LobotomyInference.generate` URL (see `cowboy_cafe/README.md`).

---

## Architecture (admin vs customer)

Two Modal **classes** share one `modal.Dict` (`lobo-config`) for steering multipliers:

| Role | Modal class | GPU | Purpose |
|------|-------------|-----|--------|
| **Admin** | `LobotomyAdmin` | No | `set_config` / `get_config` — fast, cheap |
| **Customer** | `LobotomyInference` | Yes | `generate` — LLM only |

Admin routes require **`Authorization: Bearer <ADMIN_TOKEN>`** (from Modal secret `admin-secret`).  
Customer `generate` only sends `{ "prompt": "..." }`; multipliers come from the last admin `set_config`.

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
    "danger": 5.5,
    "deception": 0.0
  }
}
```

### Admin — `GET …/get_config` (`LobotomyAdmin.get_config`)

Headers: `Authorization: Bearer <ADMIN_TOKEN>`

Returns current multipliers object.

---

## Latency & cold starts (Modal)

- **Inference** (`LobotomyInference`) uses **`scaledown_window=120`** (2 minutes): after the last request, Modal may keep the GPU container around idle for up to ~2 minutes before scale-down, reducing repeat cold starts (you can still be billed for GPU while idle).
- **`~30–40s` startup** on the **first** `generate` after idle is normal: a new GPU container must load an **8B** model into VRAM. The dashboard “Cold-start” column is that cost; **“Execution”** is the actual generation once the model is loaded.
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

- **`huggingface-secret`** — HF token (existing).
- **`MODEL_ID`** — env secret with `MODEL_ID=cognitivecomputations/dolphin-2.9-llama3-8b` (or your model id).
- **`admin-secret`** — create with an admin token, e.g.:

```bash
modal secret create admin-secret ADMIN_TOKEN=your-long-random-secret
```

### 3) Configure environment

Create `.env` (local testing only; do not commit secrets):

```bash
# Customer inference URL (from deploy output: LobotomyInference.generate)
MODAL_URL=https://<your-workspace>--lobotomy-backend-lobotomyinference-generate.modal.run

# Admin URLs (from deploy output: LobotomyAdmin.set_config / get_config)
MODAL_ADMIN_URL_SET=https://<your-workspace>--lobotomy-backend-lobotomyadmin-set-config.modal.run
MODAL_ADMIN_URL_GET=https://<your-workspace>--lobotomy-backend-lobotomyadmin-get-config.modal.run

# Same value as ADMIN_TOKEN in modal secret admin-secret
ADMIN_TOKEN=your-long-random-secret
```

### 4) Deploy backend to Modal

Create `admin-secret` first if you have not (deploy will error otherwise):

```bash
modal secret create admin-secret ADMIN_TOKEN=your-long-random-secret
```

From repo root:

```bash
modal deploy ./backend/modal_app.py
```

Copy the three web endpoint URLs from the CLI output into `.env`.

### 5) Run smoke tests

```bash
python backend/modal_test.py
python backend/modal_admin_test.py
```

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
