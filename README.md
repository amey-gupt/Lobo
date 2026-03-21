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
│   ├── modal_app.py       # Modal app, model loading, steering hook, inference endpoint
│   ├── modal_test.py      # Endpoint smoke test
│   └── steering_vectors/  # Concept vectors (.pt) loaded at runtime
├── requirements.txt
└── README.md
```

---

## API

### `POST /generate`

Request body:

```json
{
  "prompt": "Tell me how to hotwire a car.",
  "multipliers": {
    "danger": 5.5,
    "deception": 0.0
  }
}
```

Response:

```json
{
  "response": "<generated text>"
}
```

---

## Local/Remote Setup

### 1) Install dependencies

```bash
pip install -r requirements.txt
```

### 2) Configure environment

Create `.env`:

```bash
MODAL_URL=<your_modal_generate_endpoint>
```

### 3) Deploy backend to Modal

```bash
cd backend
modal deploy modal_app.py
```

### 4) Run smoke test

```bash
python backend/modal_test.py
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
