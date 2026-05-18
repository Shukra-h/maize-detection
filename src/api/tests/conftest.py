from __future__ import annotations

from io import BytesIO
from pathlib import Path
import sys
from typing import Iterable

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image


API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

import main  # noqa: E402


TEST_CLASS_NAMES = [
    *main.DEFAULT_DISEASE_CLASS_NAMES,
    main.DEFAULT_UNKNOWN_CLASS_NAME,
]


class FakeModel:
    def __init__(self, probabilities: Iterable[float]):
        self.probabilities = np.array([list(probabilities)], dtype=np.float32)
        self.last_input_shape = None

    def predict(self, image_array, verbose=0):
        self.last_input_shape = image_array.shape
        return self.probabilities


@pytest.fixture(autouse=True)
def reset_model_state(monkeypatch):
    monkeypatch.setattr(main.config, "MAX_IMAGE_SIZE_MB", 10)
    main.state.model = None
    main.state.class_names = None

    yield

    main.state.model = None
    main.state.class_names = None


@pytest.fixture
def client():
    return TestClient(main.app)


@pytest.fixture
def install_fake_model():
    def _install(probabilities: Iterable[float]) -> FakeModel:
        fake_model = FakeModel(probabilities)
        main.state.model = fake_model
        main.state.class_names = list(TEST_CLASS_NAMES)
        return fake_model

    return _install


def make_test_image_bytes(
    *,
    size: tuple[int, int] = (64, 48),
    color: tuple[int, int, int] = (70, 130, 70),
    image_format: str = "PNG",
) -> bytes:
    buffer = BytesIO()
    Image.new("RGB", size, color).save(buffer, format=image_format)
    return buffer.getvalue()
