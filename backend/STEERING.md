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

---

## Debugging: garbled / random-token output with small multipliers

If **one** concept at **0.25–0.5×** with all others **off** still produces tokenizer salad (random words, mixed scripts, `ant`, `640`, etc.), the UI is usually **not** the cause. Treat it as **representation mismatch** or **broken direction**:

1. **TLens vs HF (most common)**  
   Vectors from `compute_vectors.py` live in **TransformerLens** space. Inference edits **HuggingFace** layer inputs. Those can differ enough that subtraction is effectively **noise**.  
   **Fix (recommended — runs on Modal GPU, not your laptop):** from the **repo root**:

   ```bash
   modal run backend/modal_app.py::rebuild_steering_vectors_hf
   ```

   That writes HF-aligned `.pt` files into the Modal Volume **`lobo-steering-vectors`**. `LobotomyInference` mounts that volume and prefers it over the baked **`steering_vectors_baked`** copy when `deception.pt` exists on the volume.  
   Then **redeploy** (`modal deploy backend/modal_app.py`) or let GPU workers cycle so they reload from the volume.

   **Optional:** if you have a local GPU, you can instead run `python backend/compute_vectors_hf.py` and commit the files into `steering_vectors/` before deploy (bakes into `steering_vectors_baked`).

2. **Verify what Modal actually applies**  
   Set `LOBO_DEBUG_STEERING=1` on the **LobotomyInference** Modal secret/env (see `modal_app.py`). Logs print loaded multipliers and the **L2 norm** of the combined steering vector each request.

3. **Sanity check: steering off**  
   Set all admin multipliers to **0** and Apply. Generation should match “no hook” behavior. If baseline is fine but any non-zero mult breaks output, (1) is strongly implicated.

4. **Optional knobs on Modal** (see `modal_app.py`)  
   - `STEERING_GLOBAL_SCALE` — multiply the combined vector before apply (default `1`; try `0.25` only as a temporary dampener while fixing vectors).  
   - `STEERING_COMBINED_CAP` — max L2 norm of the **sum** of scaled unit vectors (default lowered in code; tune if needed).

5. **Re-analyze directions**  
   If HF-aligned vectors still misbehave, re-check prompt pairs in `prompts.py` (whether “toxic − safe” matches the behavior you want) and try a different `STEERING_LAYER` consistently in both extraction and inference.

## Concept keys (API / baked `.pt` files)

Canonical names: `deception`, `toxicity`, `danger`, `warmth`, `stereotypes`, `formality`, `legal_compliance`.  
Legacy names `happiness`, `bias`, `compliance` are still mapped in `modal_app.normalize_multipliers` for old Modal configs.  
Inference also falls back to legacy `.pt` basenames (`happiness.pt`, etc.) if the new filenames are not on disk yet.
