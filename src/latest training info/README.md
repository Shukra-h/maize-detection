# Latest Training Info

This folder contains the training run selected for the current deployed model.

Selected run:

```text
full_v1
```

Why this run was selected:

- It is the production-selected model.
- It performed better overall than the later NLB precision experiment.
- Its `best_model.keras` was copied into `src/api/best_model.keras`.
- Its `artifacts/class_names.json` was copied into `src/api/class_names.json`.

Important files:

- `full_v1/best_model.keras`: selected trained model
- `full_v1/artifacts/class_names.json`: model class order
- `full_v1/artifacts/training_config.json`: training settings
- `full_v1/artifacts/test_metrics.json`: normal test metrics
- `full_v1/artifacts/internet_holdout_metrics.json`: harder holdout metrics
- `full_v1/plots/training_history.png`: training graph
- `full_v1/plots/confusion_matrix.png`: normal test confusion matrix
- `full_v1/plots/internet_holdout_confusion_matrix.png`: internet holdout confusion matrix
