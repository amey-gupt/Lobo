import modal
import os
from pydantic import BaseModel
from functools import partial
from typing import Dict

app = modal.App("lobotomy-backend")

MODEL_ID = "cognitivecomputations/dolphin-2.9-llama3-8b"
CONCEPTS = ["deception", "toxicity", "danger", "happiness", "bias", "formality", "compliance"]

# Modal Dict — persists admin slider config across requests
config_store = modal.Dict.from_name("lobo-config", create_if_missing=True)

DEFAULT_MULTIPLIERS = {c: 0.0 for c in CONCEPTS}

def download_model_weights():
    import huggingface_hub
    huggingface_hub.snapshot_download(MODEL_ID)

image = (
    modal.Image.debian_slim(python_version="3.10")
    .pip_install(
        "torch",
        "transformers",
        "accelerate",
        "transformer_lens",
        "fastapi",
        "pydantic",
        "huggingface_hub"
    )
    .run_function(download_model_weights, secrets=[modal.Secret.from_name("huggingface-secret")])
)

class ConfigRequest(BaseModel):
    multipliers: Dict[str, float]

class GenerateRequest(BaseModel):
    prompt: str

@app.cls(gpu="A10G", image=image, secrets=[modal.Secret.from_name("huggingface-secret")])
class LobotomyEngine:
    @modal.enter()
    def load_model(self):
        import torch
        from transformer_lens import HookedTransformer

        print("Loading model...")
        self.model = HookedTransformer.from_pretrained(
            MODEL_ID, device="cuda", dtype=torch.float16
        )

        self.steering_layer = 14
        self.hook_name = f"blocks.{self.steering_layer}.hook_resid_pre"

        vectors_dir = os.path.join(os.path.dirname(__file__), "steering_vectors")
        self.steering_vectors = {}
        for concept in CONCEPTS:
            path = os.path.join(vectors_dir, f"{concept}.pt")
            if os.path.exists(path):
                self.steering_vectors[concept] = torch.load(path, map_location="cuda")
                print(f"  Loaded vector: {concept}")
            else:
                self.steering_vectors[concept] = torch.zeros(self.model.cfg.d_model, device="cuda")
                print(f"  Warning: no vector found for {concept}, using zeros")

        print("Model loaded successfully.")

    def steering_hook(self, resid_pre, hook, multipliers):
        for concept, multiplier in multipliers.items():
            if multiplier != 0.0 and concept in self.steering_vectors:
                resid_pre = resid_pre - multiplier * self.steering_vectors[concept].unsqueeze(0).unsqueeze(0)
        return resid_pre

    @modal.web_endpoint(method="POST")
    def set_config(self, request: ConfigRequest):
        """Admin endpoint — saves slider values to persistent store."""
        config_store["multipliers"] = request.multipliers
        return {"status": "ok", "multipliers": request.multipliers}

    @modal.web_endpoint(method="GET")
    def get_config(self):
        """Returns current active slider config."""
        return config_store.get("multipliers", DEFAULT_MULTIPLIERS)

    @modal.web_endpoint(method="POST")
    def generate(self, request: GenerateRequest):
        """User-facing endpoint — prompt only, multipliers loaded from admin config."""
        import torch

        multipliers = config_store.get("multipliers", DEFAULT_MULTIPLIERS)
        hook_fn = partial(self.steering_hook, multipliers=multipliers)

        with torch.no_grad():
            output = self.model.run_with_hooks(
                request.prompt,
                max_new_tokens=100,
                fwd_hooks=[(self.hook_name, hook_fn)]
            )

        generated_text = self.model.tokenizer.decode(output[0])
        return {"response": generated_text}
