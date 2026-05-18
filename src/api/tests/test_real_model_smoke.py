from __future__ import annotations

from io import BytesIO
import json
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

import main


pytestmark = pytest.mark.slow


def test_shipped_model_loads_and_returns_probabilities():
    api_root = Path(__file__).resolve().parents[1]
    model_path = api_root / "best_model.keras"
    class_names_path = api_root / "class_names.json"

    assert model_path.exists()
    assert class_names_path.exists()

    class_names = json.loads(class_names_path.read_text())
    model = main.load_model_with_compatibility(str(model_path))

    buffer = BytesIO()
    Image.new("RGB", (224, 224), (80, 130, 70)).save(buffer, format="PNG")
    image_array = main.preprocess_image(buffer.getvalue())

    predictions = model.predict(image_array, verbose=0)

    assert predictions.shape == (1, len(class_names))
    assert np.isfinite(predictions).all()
    assert np.isclose(float(np.sum(predictions[0])), 1.0, atol=1e-3)
