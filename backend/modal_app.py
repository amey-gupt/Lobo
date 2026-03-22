import modal
import os
from typing import Annotated, Dict, Optional

from dotenv import load_dotenv
from fastapi import Header, HTTPException
from pydantic import BaseModel

load_dotenv()
MODEL_ID = os.getenv("MODEL_ID")

app = modal.App("lobotomy-backend")

CONCEPTS = [
    "deception",
    "toxicity",
    "danger",
    "warmth",
    "stereotypes",
    "formality",
    "legal_compliance",
]
os.makedirs("./backend/steering_vectors", exist_ok=True)

# HF-aligned vectors written by ``rebuild_steering_vectors_hf``; mounted alongside inference.
steering_vectors_vol = modal.Volume.from_name("lobo-steering-vectors", create_if_missing=True)

# Modal Dict — persists admin slider config across requests (shared by admin + inference)
config_store = modal.Dict.from_name("lobo-config", create_if_missing=True)

DEFAULT_MULTIPLIERS = {c: 0.0 for c in CONCEPTS}

# Pre–clarity-rename keys; still accepted from Modal ``lobo-config`` and admin ``set_config``.
LEGACY_MULTIPLIER_KEYS: Dict[str, str] = {
    "happiness": "warmth",
    "bias": "stereotypes",
    "compliance": "legal_compliance",
}


def normalize_multipliers(m: Optional[Dict[str, float]]) -> Dict[str, float]:
    """Return multipliers keyed only by ``CONCEPTS``, migrating legacy names."""
    out = {c: 0.0 for c in CONCEPTS}
    if not m:
        return out
    for c in CONCEPTS:
        if c in m:
            out[c] = float(m[c])
    for old, new in LEGACY_MULTIPLIER_KEYS.items():
        if old in m and new not in m:
            out[new] = float(m[old])
    return out


# Prefer ``warmth.pt`` etc.; fall back to pre-rename files on Modal volume / old bakes.
LEGACY_VECTOR_BASENAMES: Dict[str, tuple[str, ...]] = {
    "warmth": ("happiness",),
    "stereotypes": ("bias",),
    "legal_compliance": ("compliance",),
}


def _first_existing_vector_path(vectors_dir: str, concept: str) -> Optional[str]:
    candidates = [f"{concept}.pt"]
    for old in LEGACY_VECTOR_BASENAMES.get(concept, ()):
        candidates.append(f"{old}.pt")
    for name in candidates:
        p = os.path.join(vectors_dir, name)
        if os.path.exists(p):
            return p
    return None


def _admin_bearer_ok(authorization_header: str) -> bool:
    """Validate Authorization: Bearer <ADMIN_TOKEN> from Modal secret ``admin-secret``."""
    token = (os.environ.get("ADMIN_TOKEN") or "").strip()
    if not token:
        return False
    expected = f"Bearer {token}"
    return (authorization_header or "").strip() == expected


def download_model_weights():
    """Plain function for Image.run_function — do NOT use @app.function here."""
    import huggingface_hub

    os.environ["HF_HUB_DISABLE_PROGRESS_BARS"] = "1"
    model_id = os.environ.get("MODEL_ID") or MODEL_ID or "cognitivecomputations/dolphin-2.9-llama3-8b"
    huggingface_hub.snapshot_download(model_id)


# CPU-only: config API — no torch, no GPU
admin_image = modal.Image.debian_slim(python_version="3.10").pip_install(
    "fastapi", "pydantic", "python-dotenv"
)

# GPU inference: heavy image + TLens-era vectors as fallback (see ``steering_vectors_baked``).
inference_image = (
    modal.Image.debian_slim(python_version="3.10")
    .pip_install(
        "torch",
        "transformers",
        "accelerate",
        "fastapi",
        "pydantic",
        "huggingface_hub",
        "python-dotenv",
        "supabase",
    )
    .add_local_dir("./backend/steering_vectors", "/root/steering_vectors_baked", copy=True)
    .run_function(download_model_weights, secrets=[modal.Secret.from_name("huggingface-secret")])
)

# Smaller image for one-off HF vector rebuild (no supabase).
# Modal imports **this entire file** when resolving ``run_function(download_model_weights)``,
# so top-level ``fastapi`` / ``pydantic`` / ``dotenv`` must be installable in this image too.
# Modal: any ``run_function`` / build step must come *before* ``add_local_*``, or use ``copy=True``
# with nothing after. We snapshot weights first, then bake ``prompts.py`` into the image.
vector_rebuild_image = (
    modal.Image.debian_slim(python_version="3.10")
    .pip_install(
        "torch",
        "transformers",
        "accelerate",
        "huggingface_hub",
        "python-dotenv",
        "fastapi",
        "pydantic",
    )
    .env({"HF_HUB_DISABLE_PROGRESS_BARS": "1"})
    .run_function(download_model_weights, secrets=[modal.Secret.from_name("huggingface-secret")])
    .add_local_file("./backend/prompts.py", "/root/prompts.py", copy=True)
)


def _model_id_runtime() -> str:
    return (
        (os.environ.get("MODEL_ID") or "").strip()
        or (MODEL_ID or "").strip()
        or "cognitivecomputations/dolphin-2.9-llama3-8b"
    )


def _steering_vectors_dir() -> str:
    """Prefer Volume (HF-rebuilt); else baked repo vectors."""
    vol_dir = "/root/steering_vectors"
    baked = "/root/steering_vectors_baked"
    marker = os.path.join(vol_dir, "deception.pt")
    if os.path.isfile(marker):
        return vol_dir
    return baked


@app.function(
    gpu="A10G",
    image=vector_rebuild_image,
    secrets=[
        modal.Secret.from_name("huggingface-secret"),
        modal.Secret.from_name("MODEL_ID"),
    ],
    volumes={"/root/steering_vectors": steering_vectors_vol},
    timeout=60 * 60 * 4,
)
def rebuild_steering_vectors_hf() -> dict:
    """
    Recompute steering ``.pt`` files in **HuggingFace** space (same hook as ``LobotomyInference``).

    Run from repo root (GPU Modal only — not your laptop):

        modal run backend/modal_app.py::rebuild_steering_vectors_hf

    Writes into Volume ``lobo-steering-vectors`` (mounted at ``/root/steering_vectors``).
    New ``LobotomyInference`` containers load from this volume when ``deception.pt`` exists there.

    Optional env on the function (Modal dashboard / ``modal run --env``):

    - ``STEERING_LAYER`` — default ``14`` (must match ``LobotomyInference.steering_layer``).
    """
    import sys

    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer

    sys.path.insert(0, "/root")
    from prompts import ALL_CONCEPTS  # noqa: E402

    mid = _model_id_runtime()
    layer = int(os.environ.get("STEERING_LAYER", "14") or "14")
    device = torch.device("cuda")
    dtype = torch.float16

    print(f"rebuild_steering_vectors_hf: MODEL_ID={mid!r} layer={layer}")

    tokenizer = AutoTokenizer.from_pretrained(mid)
    model = AutoModelForCausalLM.from_pretrained(
        mid,
        torch_dtype=dtype,
        device_map="cuda",
        low_cpu_mem_usage=True,
    )
    model.eval()
    hidden = model.config.hidden_size

    def mean_residual_for_prompt(prompt: str) -> torch.Tensor:
        captured: list[torch.Tensor] = []

        def pre_hook(module, inputs):
            h = inputs[0]
            captured.append(h.detach().float().mean(dim=1).squeeze(0).clone())
            return None

        handle = model.model.layers[layer].register_forward_pre_hook(pre_hook)
        try:
            with torch.no_grad():
                batch = tokenizer(prompt, return_tensors="pt").to(device)
                model(**batch)
        finally:
            handle.remove()
        if not captured:
            raise RuntimeError("Forward hook did not run")
        return captured[-1].cpu()

    def mean_over_prompts(prompts: list[str]) -> torch.Tensor:
        acc = None
        for p in prompts:
            v = mean_residual_for_prompt(p)
            acc = v if acc is None else acc + v
        return acc / len(prompts)

    out: dict[str, str] = {}
    for concept, spec in ALL_CONCEPTS.items():
        print(f"  concept: {concept} ({len(spec['toxic'])} toxic, {len(spec['safe'])} safe prompts)")
        with torch.no_grad():
            toxic_mean = mean_over_prompts(spec["toxic"])
            safe_mean = mean_over_prompts(spec["safe"])
        steering = (toxic_mean - safe_mean).to(dtype=torch.float16)
        if steering.shape[0] != hidden:
            raise RuntimeError(f"{concept}: bad shape {steering.shape}, expected [{hidden}]")
        path = os.path.join("/root/steering_vectors", f"{concept}.pt")
        torch.save(steering, path)
        out[concept] = path
        print(f"    saved {path} raw_L2={steering.norm().item():.4f}")

    steering_vectors_vol.commit()
    print("Volume lobo-steering-vectors committed. Redeploy or wait for new inference workers to pick up files.")
    return {"status": "ok", "saved": out, "model_id": mid, "layer": layer}


class ConfigRequest(BaseModel):
    multipliers: Dict[str, float]


class GenerateRequest(BaseModel):
    prompt: str


@app.cls(image=admin_image, secrets=[modal.Secret.from_name("admin-secret")])
class LobotomyAdmin:
    """Admin-only: read/write steering multipliers. CPU-only — does not load the LLM."""

    @modal.fastapi_endpoint(method="POST")
    def set_config(
        self,
        body: ConfigRequest,
        authorization: Annotated[Optional[str], Header()] = None,
    ):
        # Use Header() — not a bare `request` param — or FastAPI treats `request` as a query field (422).
        if not _admin_bearer_ok(authorization or ""):
            raise HTTPException(status_code=401, detail="Unauthorized")
        merged = normalize_multipliers(body.multipliers)
        config_store["multipliers"] = merged
        return {"status": "ok", "multipliers": merged}

    @modal.fastapi_endpoint(method="GET")
    def get_config(
        self,
        authorization: Annotated[Optional[str], Header()] = None,
    ):
        if not _admin_bearer_ok(authorization or ""):
            raise HTTPException(status_code=401, detail="Unauthorized")
        return normalize_multipliers(config_store.get("multipliers", DEFAULT_MULTIPLIERS))


@app.cls(
    gpu="A10G",
    image=inference_image,
    secrets=[
        modal.Secret.from_name("huggingface-secret"),
        modal.Secret.from_name("MODEL_ID"),
        modal.Secret.from_name("supabase-secret"),
    ],
    volumes={"/root/steering_vectors": steering_vectors_vol},
    # Keep GPU container idle up to 2 min after last request (fewer cold starts; still billed while idle).
    scaledown_window=120,
)
class LobotomyInference:
    """Customer-facing generation only. GPU + model — keep admin traffic off this class."""

    @modal.enter()
    def load_model(self):
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer

        print("Loading Dolphin model via Transformers...")
        self.tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
        self.model = AutoModelForCausalLM.from_pretrained(
            MODEL_ID,
            torch_dtype=torch.float16,
            device_map="cuda",
            low_cpu_mem_usage=True,
        )

        self.steering_layer = int(os.environ.get("STEERING_LAYER", "14") or "14")

        vectors_dir = _steering_vectors_dir()
        print(f"Loading steering vectors from: {vectors_dir}")
        self.steering_vectors = {}
        hidden_size = self.model.config.hidden_size
        for concept in CONCEPTS:
            path = _first_existing_vector_path(vectors_dir, concept)
            if path is not None:
                v = torch.load(path, map_location="cuda").to(dtype=torch.float16)
                # Unit-norm so admin multipliers are interpretable; raw (toxic−safe) can be huge.
                n = v.norm()
                if n > 1e-6:
                    v = v / n
                self.steering_vectors[concept] = v
                src = os.path.basename(path)
                print(f"  Loaded vector: {concept} from {src} (L2-normalized)")
            else:
                self.steering_vectors[concept] = torch.zeros(
                    hidden_size, device="cuda", dtype=torch.float16
                )
                print(f"  Warning: no vector found for {concept}, using zeros")

        print("Model loaded successfully.")

    def _build_steering_vector(self, multipliers):
        import torch

        # Sum_i multiplier_i * v_i  with each v_i unit-norm; apply: h ← h − total
        # (v_i from compute_vectors = toxic_mean − safe_mean → subtracting reduces toxic direction).
        total = torch.zeros_like(next(iter(self.steering_vectors.values())))
        for concept, multiplier in multipliers.items():
            if multiplier != 0.0 and concept in self.steering_vectors:
                total = total + (multiplier * self.steering_vectors[concept])
        # Optional global dampening while debugging TLens/HF mismatch (default 1.0).
        scale = float(os.environ.get("STEERING_GLOBAL_SCALE", "1") or "1")
        if abs(scale - 1.0) > 1e-9:
            total = total * scale
        # Cap combined step so extreme sliders don't obliterate activations
        cap = float(os.environ.get("STEERING_COMBINED_CAP", "4") or "4")
        tn = total.norm()
        if tn > 1e-6 and cap > 0 and tn > cap:
            total = total * (cap / tn)
        return total

    @modal.fastapi_endpoint(method="POST")
    def generate(self, request: GenerateRequest):
        """Public prompt endpoint — multipliers come from admin ``config_store``."""
        import torch

        multipliers = normalize_multipliers(
            config_store.get("multipliers", DEFAULT_MULTIPLIERS)
        )
        total_vec = self._build_steering_vector(multipliers)
        if os.environ.get("LOBO_DEBUG_STEERING", "").strip().lower() in ("1", "true", "yes"):
            tn = float(total_vec.norm().item())
            print(f"[LOBO_DEBUG_STEERING] multipliers={dict(multipliers)} combined_L2={tn:.4f}")
        steering_vector = total_vec.view(1, 1, -1)

        def pre_hook(module, inputs):
            hidden_states = inputs[0] - steering_vector
            return (hidden_states, *inputs[1:])

        target_layer = self.model.model.layers[self.steering_layer]
        hook_handle = target_layer.register_forward_pre_hook(pre_hook)
        try:
            model_inputs = self.tokenizer(request.prompt, return_tensors="pt").to("cuda")
            input_len = model_inputs["input_ids"].shape[1]
            output_tokens = self.model.generate(
                **model_inputs,
                max_new_tokens=160,
                do_sample=True,
                temperature=0.65,
                repetition_penalty=1.18,
                no_repeat_ngram_size=3,
            )
        finally:
            hook_handle.remove()

        # Decode ONLY new tokens — full-sequence decode repeats the entire prompt in the response.
        new_tokens = output_tokens[0][input_len:]
        generated_text = self.tokenizer.decode(new_tokens, skip_special_tokens=True).strip()

        try:
            from supabase import create_client
            sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
            sb.table("chat_logs").insert({
                "prompt": request.prompt,
                "response": generated_text,
                "multipliers": multipliers,
            }).execute()
        except Exception as e:
            print(f"Supabase insert failed: {e}")

        return {"response": generated_text}
