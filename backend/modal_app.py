# TODO: Modal app entry point
# - Define Modal image with torch, transformers, huggingface_hub
# - Load Dolphin Llama3 8B on container startup, keep warm
# - Load precomputed steering vectors from steering_vectors/
# - Expose POST /generate endpoint (inputs: prompt, steering_multiplier)
# - Apply steering hook to residual stream at layer 14 during inference
# - Return generated text + activation L2 norm for frontend visualization
