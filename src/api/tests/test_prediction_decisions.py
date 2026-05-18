from __future__ import annotations

import main

from conftest import make_test_image_bytes


def post_image(client):
    return client.post(
        "/predict",
        files={"file": ("leaf.png", make_test_image_bytes(), "image/png")},
    )


def test_strong_maize_prediction_is_accepted(client, install_fake_model):
    fake_model = install_fake_model([0.9, 0.03, 0.03, 0.02, 0.02])

    response = post_image(client)
    body = response.json()

    assert response.status_code == 200
    assert body["success"] is True
    assert body["accepted"] is True
    assert body["decision"] == "accepted"
    assert body["prediction"] == main.DEFAULT_DISEASE_CLASS_NAMES[0]
    assert body["model_prediction"] == main.DEFAULT_DISEASE_CLASS_NAMES[0]
    assert body["confidence"] == 0.9
    assert body["rejection_reasons"] == []
    assert body["guidance"]["title"] == "Gray Leaf Spot"
    assert fake_model.last_input_shape == (1, 224, 224, 3)


def test_weak_maize_prediction_stays_likely_instead_of_rejected(client, install_fake_model):
    install_fake_model([0.4, 0.25, 0.2, 0.1, 0.05])

    response = post_image(client)
    body = response.json()

    assert response.status_code == 200
    assert body["accepted"] is True
    assert body["decision"] == "likely"
    assert body["prediction"] == main.DEFAULT_DISEASE_CLASS_NAMES[0]
    assert body["model_prediction"] == main.DEFAULT_DISEASE_CLASS_NAMES[0]
    assert body["confidence"] == 0.4
    assert body["rejection_reasons"] == []


def test_unknown_top_prediction_is_rejected(client, install_fake_model):
    install_fake_model([0.02, 0.02, 0.02, 0.04, 0.9])

    response = post_image(client)
    body = response.json()

    assert response.status_code == 200
    assert body["accepted"] is False
    assert body["decision"] == "rejected"
    assert body["prediction"] == main.config.UNKNOWN_LABEL
    assert body["model_prediction"] == main.DEFAULT_UNKNOWN_CLASS_NAME
    assert body["confidence"] == 0.9
    assert body["rejection_reasons"] == ["predicted_unknown_class"]
    assert body["guidance"]["title"] == "Image Rejected"


def test_response_includes_top_predictions_and_probability_map(client, install_fake_model):
    install_fake_model([0.1, 0.7, 0.08, 0.07, 0.05])

    response = post_image(client)
    body = response.json()

    assert response.status_code == 200
    assert body["all_probabilities"] == {
        main.DEFAULT_DISEASE_CLASS_NAMES[0]: 0.1,
        main.DEFAULT_DISEASE_CLASS_NAMES[1]: 0.7,
        main.DEFAULT_DISEASE_CLASS_NAMES[2]: 0.08,
        main.DEFAULT_DISEASE_CLASS_NAMES[3]: 0.07,
        main.DEFAULT_UNKNOWN_CLASS_NAME: 0.05,
    }
    assert body["top_predictions"] == [
        {"class_name": main.DEFAULT_DISEASE_CLASS_NAMES[1], "probability": 0.7},
        {"class_name": main.DEFAULT_DISEASE_CLASS_NAMES[0], "probability": 0.1},
        {"class_name": main.DEFAULT_DISEASE_CLASS_NAMES[2], "probability": 0.08},
    ]
