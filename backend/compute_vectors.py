# TODO: One-time script to precompute steering vectors (run before deploying)
# - Load toxic_prompts and safe_prompts from prompts.py
# - Run each prompt through the model, capture activations at layer 14
# - Compute toxic_mean and safe_mean activation tensors
# - steering_vector = toxic_mean - safe_mean
# - Save to steering_vectors/deception.pt and steering_vectors/toxicity.pt
