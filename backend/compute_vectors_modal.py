import io
import os
import modal
from modal_app import inference_image, app, CONCEPTS

STEERING_LAYER = 14

image_with_prompts = inference_image.add_local_file("./prompts.py", "/root/prompts.py")

@app.function(gpu="A10G", image=image_with_prompts, secrets=[modal.Secret.from_name("huggingface-secret"), modal.Secret.from_name("MODEL_ID")], timeout=3600)
def compute_vectors():
    import sys
    sys.path.insert(0, "/root")
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer
    from prompts import ALL_CONCEPTS

    model_id = os.environ.get("MODEL_ID") or "cognitivecomputations/dolphin-2.9-llama3-8b"
    print("Loading model...")
    tokenizer = AutoTokenizer.from_pretrained(model_id)
    model = AutoModelForCausalLM.from_pretrained(
        model_id,
        dtype=torch.float16,
        device_map="cuda",
        low_cpu_mem_usage=True,
    )
    model.eval()

    def get_mean_activation(prompts):
        acts = []
        captured = {}

        def hook_fn(module, input, output):
            # output[0] is [batch, seq_len, d_model]
            captured["act"] = output[0].detach().float()

        handle = model.model.layers[STEERING_LAYER].register_forward_hook(hook_fn)
        try:
            for prompt in prompts:
                inputs = tokenizer(prompt, return_tensors="pt").to("cuda")
                with torch.no_grad():
                    model(**inputs)
                # mean over seq_len -> [d_model]
                acts.append(captured["act"][0].mean(dim=0))
        finally:
            handle.remove()

        return torch.stack(acts).mean(dim=0)

    results = {}
    for concept, prompts in ALL_CONCEPTS.items():
        print(f"Computing vector for: {concept}")
        toxic_mean = get_mean_activation(prompts["toxic"])
        safe_mean  = get_mean_activation(prompts["safe"])
        vector = (toxic_mean - safe_mean).to(dtype=torch.float16)
        buf = io.BytesIO()
        torch.save(vector, buf)
        results[concept] = buf.getvalue()
        print(f"  Done: {concept}")

    return results

@app.local_entrypoint()
def main():
    save_dir = os.path.join(os.path.dirname(__file__), "steering_vectors")
    os.makedirs(save_dir, exist_ok=True)

    print("Running vector computation on Modal A10G...")
    results = compute_vectors.remote()

    for concept, data in results.items():
        path = os.path.join(save_dir, f"{concept}.pt")
        with open(path, "wb") as f:
            f.write(data)
        print(f"Saved -> {path}")

    print("All steering vectors saved locally.")
