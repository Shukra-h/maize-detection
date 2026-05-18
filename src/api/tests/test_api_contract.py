from __future__ import annotations

import main

from conftest import TEST_CLASS_NAMES, make_test_image_bytes


def test_root_reports_service_status_without_loading_lifespan(client):
    response = client.get("/")

    assert response.status_code == 200
    assert response.json() == {
        "service": "Maize Disease Detection API",
        "status": "online",
        "version": "2.0.0",
        "model_loaded": False,
    }


def test_health_returns_model_metadata(client, install_fake_model):
    install_fake_model([0.8, 0.05, 0.05, 0.05, 0.05])

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
    assert response.json()["model"] == {
        "loaded": True,
        "input_size": [224, 224],
        "classes": len(TEST_CLASS_NAMES),
    }


def test_health_returns_503_when_model_is_missing(client):
    response = client.get("/health")

    assert response.status_code == 503
    assert response.json()["detail"] == "Model not loaded"


def test_classes_returns_runtime_class_order(client, install_fake_model):
    install_fake_model([0.8, 0.05, 0.05, 0.05, 0.05])

    response = client.get("/classes")

    assert response.status_code == 200
    assert response.json() == {
        "classes": TEST_CLASS_NAMES,
        "count": len(TEST_CLASS_NAMES),
    }


def test_predict_rejects_non_image_upload(client, install_fake_model):
    install_fake_model([0.8, 0.05, 0.05, 0.05, 0.05])

    response = client.post(
        "/predict",
        files={"file": ("notes.txt", b"not an image", "text/plain")},
    )

    assert response.status_code == 400
    assert "Invalid file type" in response.json()["detail"]


def test_predict_rejects_invalid_image_bytes(client, install_fake_model):
    install_fake_model([0.8, 0.05, 0.05, 0.05, 0.05])

    response = client.post(
        "/predict",
        files={"file": ("broken.png", b"not really a png", "image/png")},
    )

    assert response.status_code == 400
    assert response.json()["detail"].startswith("Invalid image:")


def test_predict_rejects_oversized_image(client, install_fake_model, monkeypatch):
    install_fake_model([0.8, 0.05, 0.05, 0.05, 0.05])
    monkeypatch.setattr(main.config, "MAX_IMAGE_SIZE_MB", 0)

    response = client.post(
        "/predict",
        files={"file": ("leaf.png", make_test_image_bytes(), "image/png")},
    )

    assert response.status_code == 413
    assert response.json()["detail"] == "Image too large. Max size: 0MB"
