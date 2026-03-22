#!/usr/bin/env python3
"""
Recompute steering vectors in the **same** representation space as Modal inference.

``compute_vectors.py`` uses TransformerLens ``HookedTransformer`` + ``hook_resid_pre``.
``modal_app.py`` applies vectors in HuggingFace ``LlamaForCausalLM`` at
``model.model.layers[L]`` **forward pre-hook** on ``inputs[0]``.

Those two tensors are often **not** identical for the same nominal "layer 14", so subtracting
TLens-derived directions during HF generation can behave like **random noise** — including
at small multipliers (e.g. 0.5×), producing garbled / multilingual junk.

**Preferred (no local GPU):** from repo root run Modal — see ``STEERING.md`` / ``modal_app.py::rebuild_steering_vectors_hf``.

**Local (only if you have a GPU):**

  cd backend
  pip install torch transformers accelerate
  python compute_vectors_hf.py

Outputs overwrite ``steering_vectors/<concept>.pt`` (backup first). Redeploy Modal so the image bakes them into ``steering_vectors_baked``.
"""

from __future__ import annotations

import os
import sys

# Allow `python path/to/compute_vectors_hf.py` from any cwd
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

# Same keys as modal_app / compute_vectors
from prompts import ALL_CONCEPTS

MODEL_ID = os.environ.get("MODEL_ID", "cognitivecomputations/dolphin-2.9-llama3-8b")
LAYER = int(os.environ.get("STEERING_LAYER", "14"))
SAVE_DIR = os.path.join(_BACKEND_DIR, "steering_vectors")


def _mean_residual_at_layer(model, tokenizer, layer_idx: int, prompt: str, device: torch.device) -> torch.Tensor:
    """Mean over sequence of layer input hidden states [d_model] (float32 on CPU)."""
    captured: list[torch.Tensor] = []

    def pre_hook(module, inputs):
        h = inputs[0]
        # [batch, seq, hidden]
        captured.append(h.detach().float().mean(dim=1).squeeze(0).clone())
        return None

    handle = model.model.layers[layer_idx].register_forward_pre_hook(pre_hook)
    try:
        with torch.no_grad():
            batch = tokenizer(prompt, return_tensors="pt").to(device)
            model(**batch)
    finally:
        handle.remove()

    if not captured:
        raise RuntimeError("Hook did not fire — check layer index / model class")
    return captured[-1].cpu()


def mean_over_prompts(model, tokenizer, layer_idx: int, prompts: list[str], device: torch.device) -> torch.Tensor:
    acc = None
    for p in prompts:
        v = _mean_residual_at_layer(model, tokenizer, layer_idx, p, device)
        acc = v if acc is None else acc + v
    return acc / len(prompts)


def main() -> None:
    if not torch.cuda.is_available():
        print("Warning: CUDA not available — this will be very slow on CPU.", file=sys.stderr)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    dtype = torch.float16 if device.type == "cuda" else torch.float32

    print(f"Loading HF model {MODEL_ID!r} ({dtype}) on {device} …")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    model = AutoModelForCausalLM.from_pretrained(
        MODEL_ID,
        torch_dtype=dtype,
        device_map="cuda" if device.type == "cuda" else None,
        low_cpu_mem_usage=True,
    )
    if device.type == "cpu":
        model = model.to(device)
    model.eval()

    os.makedirs(SAVE_DIR, exist_ok=True)
    hidden = model.config.hidden_size
    print(f"Layer index (HF): {LAYER}, hidden_size={hidden}")

    for concept, spec in ALL_CONCEPTS.items():
        print(f"Computing (HF): {concept}")
        with torch.no_grad():
            toxic_mean = mean_over_prompts(model, tokenizer, LAYER, spec["toxic"], device)
            safe_mean = mean_over_prompts(model, tokenizer, LAYER, spec["safe"], device)
        steering = (toxic_mean - safe_mean).to(dtype=torch.float16)
        if steering.shape[0] != hidden:
            raise RuntimeError(f"Bad shape {steering.shape}, expected [{hidden}]")
        path = os.path.join(SAVE_DIR, f"{concept}.pt")
        torch.save(steering, path)
        n = steering.norm().item()
        print(f"  saved {path} (L2 norm before deploy-side normalization: {n:.4f})")

    print("Done. Redeploy Modal inference image so /root/steering_vectors updates.")


if __name__ == "__main__":
    main()
