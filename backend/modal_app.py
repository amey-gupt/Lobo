import modal
import os
from typing import Annotated, Dict, Optional

from dotenv import load_dotenv
from fastapi import Header, HTTPException
from pydantic import BaseModel

load_dotenv()
MODEL_ID = os.getenv("MODEL_ID")

app = modal.App("lobotomy-backend")

CONCEPTS = ["deception", "toxicity", "danger", "happiness", "bias", "formality", "compliance"]
os.makedirs("./backend/steering_vectors", exist_ok=True)

# Modal Dict — persists admin slider config across requests (shared by admin + inference)
config_store = modal.Dict.from_name("lobo-config", create_if_missing=True)

DEFAULT_MULTIPLIERS = {c: 0.0 for c in CONCEPTS}


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

# GPU inference: heavy image + steering vectors baked in
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
    .add_local_dir("./backend/steering_vectors", "/root/steering_vectors", copy=True)
    .run_function(download_model_weights, secrets=[modal.Secret.from_name("huggingface-secret")])
)


class ConfigRequest(BaseModel):
    multipliers: Dict[str, float]


class GenerateRequest(BaseModel):
    prompt: str
    session_id: Optional[str] = None


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
        config_store["multipliers"] = body.multipliers
        return {"status": "ok", "multipliers": body.multipliers}

    @modal.fastapi_endpoint(method="GET")
    def get_config(
        self,
        authorization: Annotated[Optional[str], Header()] = None,
    ):
        if not _admin_bearer_ok(authorization or ""):
            raise HTTPException(status_code=401, detail="Unauthorized")
        return config_store.get("multipliers", DEFAULT_MULTIPLIERS)


@app.cls(
    gpu="A10G",
    image=inference_image,
    secrets=[
        modal.Secret.from_name("huggingface-secret"),
        modal.Secret.from_name("MODEL_ID"),
        modal.Secret.from_name("supabase-secret"),
    ],
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

        self.steering_layer = 14

        vectors_dir = "/root/steering_vectors"
        self.steering_vectors = {}
        hidden_size = self.model.config.hidden_size
        for concept in CONCEPTS:
            path = os.path.join(vectors_dir, f"{concept}.pt")
            if os.path.exists(path):
                self.steering_vectors[concept] = torch.load(
                    path, map_location="cuda"
                ).to(dtype=torch.float16)
                print(f"  Loaded vector: {concept}")
            else:
                self.steering_vectors[concept] = torch.zeros(
                    hidden_size, device="cuda", dtype=torch.float16
                )
                print(f"  Warning: no vector found for {concept}, using zeros")

        print("Model loaded successfully.")

    def _build_steering_vector(self, multipliers):
        import torch

        total = torch.zeros_like(next(iter(self.steering_vectors.values())))
        for concept, multiplier in multipliers.items():
            if multiplier != 0.0 and concept in self.steering_vectors:
                total = total + (multiplier * self.steering_vectors[concept])
        return total

    @modal.fastapi_endpoint(method="POST")
    def generate(self, request: GenerateRequest):
        """Public prompt endpoint — multipliers come from admin ``config_store``."""
        import torch

        multipliers = config_store.get("multipliers", DEFAULT_MULTIPLIERS)
        steering_vector = self._build_steering_vector(multipliers).view(1, 1, -1)

        def pre_hook(module, inputs):
            hidden_states = inputs[0] - steering_vector
            return (hidden_states, *inputs[1:])

        target_layer = self.model.model.layers[self.steering_layer]
        hook_handle = target_layer.register_forward_pre_hook(pre_hook)
        try:
            model_inputs = self.tokenizer(request.prompt, return_tensors="pt").to("cuda")
            output_tokens = self.model.generate(
                **model_inputs,
                max_new_tokens=100,
                do_sample=True,
                temperature=0.7,
            )
        finally:
            hook_handle.remove()

        generated_text = self.tokenizer.decode(output_tokens[0], skip_special_tokens=True)

        try:
            from supabase import create_client
            sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
            sb.table("chat_logs").insert({
                "prompt": request.prompt,
                "response": generated_text,
                "multipliers": multipliers,
                "session_id": request.session_id,
            }).execute()
        except Exception as e:
            print(f"Supabase insert failed: {e}")

        return {"response": generated_text}
