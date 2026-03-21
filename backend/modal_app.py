# TODO: Modal app entry point
# - Define Modal image with torch, transformers, huggingface_hub
# - Load Dolphin Llama3 8B on container startup, keep warm
# - Load precomputed steering vectors from steering_vectors/
# - Expose POST /generate endpoint (inputs: prompt, steering_multiplier)
# - Apply steering hook to residual stream at layer 14 during inference
# - Return generated text + activation L2 norm for frontend visualization

import modal
from pydantic import BaseModel

# 1. Define the Modal App
app = modal.App("lobotomy-backend")

MODEL_ID = "cognitivecomputations/dolphin-2.9-llama3-8b"

# 2. Define the Docker Image
# We install TransformerLens, PyTorch, and FastAPI.
def download_model_weights():
    import huggingface_hub
    # This caches the 16GB model weights into the Docker image at build time
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

# 3. Define the Input Schema
class InferenceRequest(BaseModel):
    prompt: str
    steering_multiplier: float  # The value from your React slider (e.g., 0.0 to 10.0)

# 4. Define the GPU Class
# We use an A10G (24GB VRAM) which perfectly fits an 8B model in fp16.
@app.cls(gpu="A10G", image=image, secrets=[modal.Secret.from_name("huggingface-secret")])
class LobotomyEngine:
    @modal.enter()
    def load_model(self):
        """This runs once when the container starts. It loads the model into VRAM."""
        print("Loading TransformerLens model...")
        import torch
        from transformer_lens import HookedTransformer

        # Load the model directly into TransformerLens
        self.model = HookedTransformer.from_pretrained(
            MODEL_ID,
            device="cuda",
            dtype=torch.float16,
        )
        
        # TODO: You must calculate your actual steering vector here using contrastive pairs.
        # For now, we initialize a dummy vector of the correct shape (e.g., layer 14).
        self.steering_layer = 14
        self.hook_name = f"blocks.{self.steering_layer}.hook_resid_pre"
        self.steering_vector = torch.zeros(self.model.cfg.d_model, device="cuda")
        print("Model loaded successfully.")

    def steering_hook(self, resid_pre, hook, multiplier):
        """This is the surgical injection. We subtract the concept from the residual stream."""
        # resid_pre shape is [batch, position, d_model]
        # We subtract the vector scaled by your frontend slider
        resid_pre[:] = resid_pre - (multiplier * self.steering_vector)
        return resid_pre

    @modal.web_endpoint(method="POST")
    def generate(self, request: InferenceRequest):
        """This is the REST API endpoint your React app will call."""
        import torch
        from functools import partial

        print(f"Received prompt: {request.prompt} | Multiplier: {request.steering_multiplier}")
        
        # Create a partial function to pass the multiplier into the hook
        hook_fn = partial(self.steering_hook, multiplier=request.steering_multiplier)

        # Run inference with the hook applied
        with torch.no_grad():
            output = self.model.run_with_hooks(
                request.prompt,
                max_new_tokens=100,
                fwd_hooks=[(self.hook_name, hook_fn)]
            )
            
        # TransformerLens returns a tensor of token IDs by default, so we decode it
        generated_text = self.model.tokenizer.decode(output[0])
        
        return {"response": generated_text}