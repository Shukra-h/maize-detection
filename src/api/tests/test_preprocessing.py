from __future__ import annotations

from io import BytesIO

import numpy as np
import pytest
from fastapi import HTTPException
from PIL import Image

import main


def test_preprocess_image_converts_to_model_input_shape():
    buffer = BytesIO()
    Image.new("L", (32, 16), 120).save(buffer, format="PNG")

    image_array = main.preprocess_image(buffer.getvalue())

    assert image_array.shape == (1, 224, 224, 3)
    assert image_array.dtype == np.float32
    assert image_array.min() >= 0
    assert image_array.max() <= 255


def test_preprocess_image_raises_http_400_for_invalid_bytes():
    with pytest.raises(HTTPException) as exc_info:
        main.preprocess_image(b"bad image bytes")

    assert exc_info.value.status_code == 400
    assert str(exc_info.value.detail).startswith("Invalid image:")
