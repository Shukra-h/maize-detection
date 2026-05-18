# High Accuracy Image Set

This folder contains curated examples that the shipped model predicts correctly with at least `85%` confidence.

Source dataset:

```text
Dataset Folder/maize_dataset_v3
```

Model used for curation:

```text
src/api/best_model.keras
```

Selection rule:

- only images from `test`, `internet_holdout_test`, `valid`, or `train` were considered
- the predicted class had to match the folder label
- model confidence had to be at least `85%`
- up to `50` images were copied per class
- cleaner evaluation splits were preferred before `valid` and `train`

Counts copied:

- `Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot`: `50` images
- `Corn_(maize)___Common_rust_`: `9` images
- `Corn_(maize)___Northern_Leaf_Blight`: `0` images
- `Corn_(maize)___healthy`: `50` images
- `unknown_unclassified`: `50` images


See `manifest.json` for the source path, source split, predicted class, and confidence for every copied image.

Important note: this is a curated high-confidence set for demos and manual checks. It is not a fair final test set, because some images may come from `valid` or `train` when there were not enough high-confidence examples in `test` and `internet_holdout_test`.


## Northern Leaf Blight Note

The current shipped model has `0` correctly predicted Northern Leaf Blight images at `85%+` confidence across `maize_dataset_v3`.

For transparency, the strict high-confidence Northern Leaf Blight folder is left empty.

A separate folder contains the best available correctly predicted NLB examples below the threshold:

```text
_best_available_below_85/Corn_(maize)___Northern_Leaf_Blight
```

Those files are useful for inspection, but they do not satisfy the `85%+` confidence rule.
