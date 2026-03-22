import os
import torch
from transformer_lens import HookedTransformer
from prompts import ALL_CONCEPTS

MODEL_ID = "cognitivecomputations/dolphin-2.9-llama3-8b"
HOOK_NAME = "blocks.14.hook_resid_pre"
SAVE_DIR = os.path.join(os.path.dirname(__file__), "steering_vectors")

def get_mean_activation(model, prompts):
    acts = []
    for prompt in prompts:
        _, cache = model.run_with_cache(prompt, names_filter=HOOK_NAME)
        # shape: [batch, seq_len, d_model]  -  average over token positions
        acts.append(cache[HOOK_NAME].mean(dim=1).squeeze(0))
    return torch.stack(acts).mean(dim=0)

def main():
    print("Loading model...")
    model = HookedTransformer.from_pretrained(MODEL_ID, device="cuda", dtype=torch.float16)
    model.eval()

    for concept, prompts in ALL_CONCEPTS.items():
        print(f"Computing vector for: {concept}")
        with torch.no_grad():
            toxic_mean = get_mean_activation(model, prompts["toxic"])
            safe_mean  = get_mean_activation(model, prompts["safe"])

        steering_vector = toxic_mean - safe_mean
        save_path = os.path.join(SAVE_DIR, f"{concept}.pt")
        torch.save(steering_vector, save_path)
        print(f"  Saved -> {save_path}")

    print("Done. All steering vectors saved.")

if __name__ == "__main__":
    main()
