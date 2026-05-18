# File Guide For Latest Training Info

This folder preserves the selected training run used for the current deployed model.

The selected run is:

```text
full_v1
```

This was the production-selected run. A later experiment called `nlb_precision_v1_eval_baseline` was also trained, but it was not selected because it improved Northern Leaf Blight precision while hurting recall too much.

## Folder Layout

```text
latest training info/
├── README.md
└── full_v1/
    ├── best_model.keras
    ├── head_latest_model.keras
    ├── head_best_model.keras
    ├── finetune_latest_model.keras
    ├── finetune_best_model.keras
    ├── artifacts/
    ├── plots/
    └── state/
```

## Top-Level Files

### `README.md`

Short summary explaining why this folder exists and why `full_v1` is the selected model run.

Use this file when you need a quick reminder of what the folder contains.

## Model Files In `full_v1/`

### `best_model.keras`

This is the selected final model from the `full_v1` run.

This is the most important file in this folder. It is the model that was copied into the backend as:

```text
src/api/best_model.keras
```

The FastAPI backend loads this model to make predictions.

### `head_latest_model.keras`

This is the latest checkpoint from the first training stage.

In the first stage, the MobileNetV2 backbone was frozen and only the new classification head was trained.

This file is useful for debugging or comparing what the model looked like before fine-tuning.

### `head_best_model.keras`

This is the best checkpoint from the first training stage, based on validation loss.

It shows the best version of the model before the MobileNetV2 layers were partially unfrozen.

### `finetune_latest_model.keras`

This is the latest checkpoint from the fine-tuning stage.

In this stage, the last 30 layers of MobileNetV2 were unfrozen and trained with a much smaller learning rate.

### `finetune_best_model.keras`

This is the best checkpoint from the fine-tuning stage, based on validation loss.

For this project, the final deployed model was selected from the fine-tuned model output.

## Files In `full_v1/artifacts/`

### `class_names.json`

Stores the exact class order used during training.

This file is critical because the model outputs probabilities by index. The backend needs this file to know which index maps to which class.

Example:

```text
index 0 -> Gray Leaf Spot
index 1 -> Common Rust
index 2 -> Northern Leaf Blight
index 3 -> Healthy
index 4 -> unknown_unclassified
```

If this file is wrong, the backend can show the wrong disease name even when the model output is correct.

### `training_config.json`

Stores the main training settings used for the run.

Important values include:

- image size: `224 x 224`
- batch size: `32`
- head training epochs: `8`
- fine-tuning epochs: `12`
- head learning rate: `0.001`
- fine-tuning learning rate: `0.00001`
- unfrozen MobileNetV2 layers: last `30`
- label smoothing: `0.1`
- dropout rate: `0.35`
- dataset root: `Dataset Folder/maize_dataset_v3`
- save directory: `local_training_runs/full_v1`

Use this file to explain how the model was trained.

### `dataset_stats.json`

Stores the number of images used in each split and class.

It records counts for:

- `train`
- `valid`
- `test`
- `internet_holdout_test`

It also records the runtime device info, including that TensorFlow saw the Apple GPU during local training.

Use this file to explain what data the model learned from and what data was used for evaluation.

### `runtime_info.json`

Stores environment details from training.

It includes:

- TensorFlow version
- detected CPU/GPU devices
- mixed precision setting

This is useful when explaining where and how training ran.

### `training_history.json`

Stores the training history across epochs in JSON form.

It includes values such as:

- training accuracy
- validation accuracy
- training loss
- validation loss
- top-2 accuracy
- learning rate

This file backs the training graph and can be used for deeper analysis.

### `head_training_log.csv`

CSV log for the first training phase.

This phase trained only the new classification head while MobileNetV2 stayed frozen.

Use this file to show how the model improved during the head-training stage.

### `finetune_training_log.csv`

CSV log for the fine-tuning phase.

This phase unfroze the top part of MobileNetV2 and trained it with a smaller learning rate.

Use this file to show how fine-tuning affected validation accuracy and loss.

### `test_metrics.json`

Stores final metrics on the normal test set.

Final normal test results:

- accuracy: about `93.08%`
- top-2 accuracy: about `97.82%`

This is the main in-domain performance result.

### `classification_report.json`

Detailed per-class report for the normal test set.

It includes:

- precision
- recall
- F1 score
- support count

Use this file when you need to explain how each class performed individually.

### `internet_holdout_metrics.json`

Stores final metrics on the harder internet holdout test set.

Final internet holdout results:

- accuracy: about `89.91%`
- top-2 accuracy: about `97.67%`

This is important because it shows how the model performed on more realistic external-style images.

### `internet_holdout_classification_report.json`

Detailed per-class report for the internet holdout test set.

Use this file to explain how the model performed on harder real-world-style examples.

This file was especially useful for analyzing Northern Leaf Blight behavior.

## Files In `full_v1/plots/`

### `training_history.png`

Graph of training and validation accuracy/loss over time.

Use this during presentation to show whether the model improved during training and whether it showed signs of overfitting.

### `confusion_matrix.png`

Confusion matrix for the normal test set.

It shows which classes the model predicted correctly and which classes it confused.

### `internet_holdout_confusion_matrix.png`

Confusion matrix for the harder internet holdout set.

This is useful for discussing real-world performance because it shows where the model struggled on less controlled images.

## Files In `full_v1/state/`

### `training_state.json`

Stores the final training state.

For `full_v1`, it shows that training completed successfully.

This file was used by the training process to track progress and support resumability.

## How These Files Connect To The Deployed App

The most important deployment files are:

```text
full_v1/best_model.keras
full_v1/artifacts/class_names.json
```

They were copied into:

```text
src/api/best_model.keras
src/api/class_names.json
```

The backend loads the model, reads the class names, preprocesses uploaded images, and returns the highest scoring class unless `unknown_unclassified` is the top prediction.

## What To Mention In A Presentation

The training run used MobileNetV2 transfer learning, trained in two stages, saved checkpoints throughout the process, and evaluated the final model on both a normal test set and a harder internet holdout set.

The final selected model was `full_v1`, not the later NLB precision experiment.

The selected model achieved about `93%` accuracy on the normal test set and about `90%` accuracy on the internet holdout set.
