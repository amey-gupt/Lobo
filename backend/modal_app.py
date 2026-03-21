import modal
import os
from pydantic import BaseModel
from typing import Dict
from dotenv import load_dotenv

load_dotenv()
MODEL_ID = os.getenv("MODEL_ID")

app = modal.App("lobotomy-backend")

CONCEPTS = ["deception", "toxicity", "danger", "happiness", "bias", "formality", "compliance"]
os.makedirs("./backend/steering_vectors", exist_ok=True)

# Modal Dict — persists admin slider config across requests
config_store = modal.Dict.from_name("lobo-config", create_if_missing=True)

DEFAULT_MULTIPLIERS = {c: 0.0 for c in CONCEPTS}

def download_model_weights():
    import huggingface_hub
    os.environ["HF_HUB_DISABLE_PROGRESS_BARS"] = "1"
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
    .add_local_dir("./backend/steering_vectors", "/root/steering_vectors", copy=True)
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

        # Load vectors from the remote mounted path
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
    def set_config(self, request: ConfigRequest):
        """Admin endpoint — saves slider values to persistent store."""
        config_store["multipliers"] = request.multipliers
        return {"status": "ok", "multipliers": request.multipliers}

    @modal.fastapi_endpoint(method="GET")
    def get_config(self):
        """Returns current active slider config."""
        return config_store.get("multipliers", DEFAULT_MULTIPLIERS)

    @modal.fastapi_endpoint(method="POST")
    def generate(self, request: GenerateRequest):
        """User-facing endpoint — prompt only, multipliers loaded from admin config."""
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
        return {"response": generated_text}