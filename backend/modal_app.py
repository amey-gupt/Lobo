import modal
import os
from pydantic import BaseModel
from functools import partial
from typing import Dict

app = modal.App("lobotomy-backend")

MODEL_ID = "cognitivecomputations/dolphin-2.9-llama3-8b"
CONCEPTS = ["deception", "toxicity", "danger", "happiness", "bias", "formality", "compliance"]
os.makedirs("./backend/steering_vectors", exist_ok=True)

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

class InferenceRequest(BaseModel):
    prompt: str
    multipliers: Dict[str, float]

@app.cls(gpu="A10G", image=image, secrets=[modal.Secret.from_name("huggingface-secret")])
class LobotomyEngine:
    @modal.enter()
    def load_model(self):
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer
        from transformer_lens import HookedTransformer

        print("Loading HF Model weights...")
        # FIX 1: Load via standard HuggingFace first
        hf_model = AutoModelForCausalLM.from_pretrained(
            MODEL_ID,
            torch_dtype=torch.float16,
            device_map="auto"
        )
        tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)

        print("Wrapping weights in HookedTransformer...")
        # Inject the weights into the base Llama-3 architecture
        self.model = HookedTransformer.from_pretrained(
            "meta-llama/Meta-Llama-3-8B", 
            hf_model=hf_model,
            tokenizer=tokenizer,
            device="cuda", 
            dtype=torch.float16
        )

        self.steering_layer = 14
        self.hook_name = f"blocks.{self.steering_layer}.hook_resid_pre"

        # Load vectors from the remote mounted path
        vectors_dir = "/root/steering_vectors"
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

    @modal.fastapi_endpoint(method="POST")
    def generate(self, request: InferenceRequest):
        import torch

        hook_fn = partial(self.steering_hook, multipliers=request.multipliers)

        with torch.no_grad():
            output = self.model.run_with_hooks(
                request.prompt,
                max_new_tokens=100,
                fwd_hooks=[(self.hook_name, hook_fn)]
            )

        generated_text = self.model.tokenizer.decode(output[0])
        return {"response": generated_text}