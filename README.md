# Lobo — Real-Time AI Inference Firewall

> Mathematically subtract dangerous concepts from an LLM's brain at inference time.

## Structure

```
Lobo/
├── backend/
│   ├── modal_app.py          # Modal endpoint — inference + steering hook
│   ├── compute_vectors.py    # One-time script to precompute steering vectors
│   ├── prompts.py            # Toxic/safe prompt datasets
│   └── steering_vectors/     # Saved .pt vector files (gitignored)
└── frontend/
    └── src/
        ├── App.jsx           # Root layout — dual pane + slider
        ├── ChatPane.jsx      # Individual chat window (raw vs steered)
        ├── ConceptSlider.jsx # Concept erasure slider (Deception, Toxicity)
        └── BrainScanner.jsx  # Live activation waveform visualization
```

## How It Works

1. Precompute a "deception direction" vector by contrasting toxic vs. safe activations at layer 14
2. At inference time, subtract `multiplier × steering_vector` from the residual stream
3. Frontend slider controls the multiplier — judges watch the model's behavior change live
