# Steering vectors: what the multiplier does

## How it’s defined in code

`compute_vectors.py` saves, per concept:

```text
steering_vector = mean(toxic prompts) − mean(safe prompts)
```

at layer 14 residual stream (`hook_resid_pre`).

Inference (`modal_app.py`) does:

```text
hidden_states ← hidden_states − multiplier × steering_vector
```

So for each concept, **a positive multiplier subtracts more of the `(toxic − safe)` direction** from activations. That is intended to **push the model away from the “toxic” side of that contrast** — i.e. **reduce** that concept’s influence (deception, toxicity, danger, …), **not increase** it.

So **increasing the multiplier is supposed to decrease** the targeted harmful concept’s presence — **if** the saved vector matches that semantics and is applied correctly.

## Why you might see the opposite (more harm at high multiplier)

1. **Missing vectors** — If `steering_vectors/<concept>.pt` is absent on the deployed image, that concept is **all zeros** and steering does nothing; the model is effectively unsteered.

2. **TransformerLens vs HuggingFace mismatch** — Vectors were computed with **TransformerLens** (`HookedTransformer`) on a given architecture slice. Inference uses **HuggingFace** `LlamaForCausalLM` at `model.model.layers[14]`. The residual at “layer 14” may **not** match TLens’s `hook_resid_pre` one-to-one, so subtracting the vector can act like **noise** or **destabilize** the network. Very large multipliers can make outputs **worse**, including more harmful or incoherent text.

3. **Too-large magnitude** — Even with the right vector, **multiplier = 10** on raw (unnormalized) vectors can be huge and **break** generation.

## What we recommend

- After pulling latest `modal_app.py`, vectors are **L2-normalized** when loaded so multiplier scale is more interpretable.
- Prefer **moderate** multipliers (e.g. **0.5–3**) first; increase only if the effect is too weak.
- For a trustworthy demo, recompute vectors using the **same** runtime as inference (HF + same hook tensor), or verify alignment between TLens and HF for your checkpoint.

## Cowboy Cafe UI

Messy “In character as…”, “Customer:…”, refusals, and hotwire steps are mostly **base model + prompt** behavior, not the steering math. Use `COWBOY_CAFE_HACKATHON_BASELINE` and sanitization on the Next route; treat **steering** as the scientific knob on Modal.
