from __future__ import annotations

from io import BytesIO
import json

import pytest
from PIL import Image, ImageDraw

import main

from conftest import make_test_image_bytes


@pytest.fixture
def isolated_feedback_store(tmp_path, monkeypatch):
    store_path = tmp_path / "feedback-store.json"
    monkeypatch.setenv("FEEDBACK_STORE_PATH", str(store_path))
    monkeypatch.setattr(main.config, "FEEDBACK_NEAR_HASH_DISTANCE", 6)
    monkeypatch.setattr(main.config, "FEEDBACK_NEAR_SUPPORT_THRESHOLD", 1.2)
    monkeypatch.setattr(main.config, "FEEDBACK_NEAR_CONSENSUS_THRESHOLD", 0.8)
    monkeypatch.setattr(main.config, "FEEDBACK_EXACT_CONSENSUS_THRESHOLD", 0.6)
    monkeypatch.setattr(main.config, "FEEDBACK_BAKED_LOW_CONFIDENCE_THRESHOLD", 0.6)
    monkeypatch.setattr(main.config, "FEEDBACK_BAKED_MIN_CONFIDENCE", 0.75)
    monkeypatch.setattr(main.config, "FEEDBACK_BAKED_MAX_CONFIDENCE", 0.85)
    monkeypatch.setattr(main.config, "SUPABASE_URL", None)
    monkeypatch.setattr(main.config, "SUPABASE_SERVICE_ROLE_KEY", None)
    monkeypatch.setattr(main, "supabase_client", None)
    return store_path


def post_image(client, image_bytes: bytes, *, filename: str = "leaf.png", content_type: str = "image/png"):
    return client.post(
        "/predict",
        files={"file": (filename, image_bytes, content_type)},
    )


def post_feedback(client, payload: dict, *, token: str = "user-a", image_bytes: bytes | None = None):
    files = None
    if image_bytes is not None:
        files = {"file": ("leaf.png", image_bytes, "image/png")}

    return client.post(
        "/feedback",
        data={"payload": json.dumps(payload)},
        files=files,
        headers={"Authorization": f"Bearer {token}"},
    )


def make_split_leaf_bytes(*, image_format: str, size: tuple[int, int] = (96, 72)) -> bytes:
    image = Image.new("RGB", size, (40, 90, 40))
    draw = ImageDraw.Draw(image)
    midpoint = size[0] // 2
    draw.rectangle((0, 0, midpoint - 1, size[1] - 1), fill=(20, 50, 20))
    draw.rectangle((midpoint, 0, size[0] - 1, size[1] - 1), fill=(185, 215, 95))

    buffer = BytesIO()
    image.save(buffer, format=image_format)
    return buffer.getvalue()


def test_feedback_for_prediction_id_returns_exact_metadata_without_changing_raw_prediction(
    client,
    install_fake_model,
    isolated_feedback_store,
):
    install_fake_model([0.9, 0.03, 0.03, 0.02, 0.02])
    image_bytes = make_test_image_bytes()

    first_prediction = post_image(client, image_bytes).json()
    assert first_prediction["feedback_adjusted"]["applied"] is False

    corrected_label = main.DEFAULT_DISEASE_CLASS_NAMES[2]
    feedback_response = post_feedback(
        client,
        {
            "prediction_id": first_prediction["prediction_id"],
            "corrected_label": corrected_label,
            "is_correct": False,
        },
    )

    assert feedback_response.status_code == 200
    assert feedback_response.json()["feedback"]["image_hash"] == first_prediction["image_hash"]

    second_response = post_image(client, image_bytes)
    body = second_response.json()

    assert second_response.status_code == 200
    assert body["prediction"] == corrected_label
    assert body["model_prediction"] == main.DEFAULT_DISEASE_CLASS_NAMES[0]
    assert body["confidence"] == 0.11
    assert body["all_probabilities"][corrected_label] == 0.11
    assert body["decision"] == "accepted"
    assert body["feedback_adjusted"]["applied"] is True
    assert body["feedback_adjusted"]["raw_prediction"] == main.DEFAULT_DISEASE_CLASS_NAMES[0]
    assert body["feedback_adjusted"]["raw_model_prediction"] == main.DEFAULT_DISEASE_CLASS_NAMES[0]
    assert body["feedback_adjusted"]["raw_confidence"] == 0.9
    assert body["feedback_adjusted"]["raw_decision"] == "accepted"
    assert body["feedback_adjusted"]["match_type"] == "exact"
    assert body["feedback_adjusted"]["corrected_label"] == corrected_label
    assert body["feedback_adjusted"]["adjusted_prediction"] == corrected_label
    assert body["feedback_adjusted"]["base_class_probability"] == 0.03
    assert body["feedback_adjusted"]["adjusted_confidence"] == 0.11
    assert body["feedback_adjusted"]["adjusted_decision"] == "accepted"
    assert body["feedback_adjusted"]["support_weight"] == 1.0
    assert body["feedback_adjusted"]["consensus"] == 1.0
    assert body["feedback_adjusted"]["is_correct"] is False
    assert body["feedback_adjusted"]["source_image_hash"] == first_prediction["image_hash"]
    assert body["feedback_adjusted"]["distance"] == 0
    assert body["feedback_adjusted"]["feedback_id"] == feedback_response.json()["feedback"]["feedback_id"]

    store = json.loads(isolated_feedback_store.read_text())
    assert store["feedback"][0]["corrected_label"] == corrected_label


def test_low_confidence_class_switch_bakes_same_image_confidence(
    client,
    install_fake_model,
    isolated_feedback_store,
):
    install_fake_model([0.55, 0.2, 0.15, 0.06, 0.04])
    image_bytes = make_test_image_bytes()

    first_prediction = post_image(client, image_bytes).json()
    assert first_prediction["prediction"] == main.DEFAULT_DISEASE_CLASS_NAMES[0]
    assert first_prediction["confidence"] == 0.55

    corrected_label = main.DEFAULT_DISEASE_CLASS_NAMES[2]
    feedback_response = post_feedback(
        client,
        {
            "prediction_id": first_prediction["prediction_id"],
            "corrected_label": corrected_label,
            "is_correct": False,
        },
    )
    assert feedback_response.status_code == 200

    expected_confidence = main.deterministic_baked_confidence(
        first_prediction["image_hash"],
        corrected_label,
    )
    second_body = post_image(client, image_bytes).json()
    third_body = post_image(client, image_bytes).json()

    assert 0.75 <= expected_confidence <= 0.85
    assert second_body["prediction"] == corrected_label
    assert second_body["confidence"] == expected_confidence
    assert second_body["all_probabilities"][corrected_label] == expected_confidence
    assert second_body["top_predictions"][0] == {
        "class_name": corrected_label,
        "probability": expected_confidence,
    }
    assert third_body["confidence"] == expected_confidence
    assert third_body["all_probabilities"][corrected_label] == expected_confidence
    assert second_body["feedback_adjusted"]["adjusted_confidence"] == expected_confidence
    assert second_body["feedback_adjusted"]["base_class_probability"] == 0.15
    assert second_body["feedback_adjusted"]["confidence_strategy"] == "baked_low_confidence_class_switch"
    assert second_body["feedback_adjusted"]["low_confidence_class_switch"] is True
    assert second_body["feedback_adjusted"]["low_confidence_correct_feedback"] is False
    assert second_body["feedback_adjusted"]["low_confidence_baked_feedback"] is True
    assert second_body["feedback_adjusted"]["baked_confidence"] == expected_confidence

    store = json.loads(isolated_feedback_store.read_text())
    assert store["feedback"][0]["reviewed_prediction"] == main.DEFAULT_DISEASE_CLASS_NAMES[0]
    assert store["feedback"][0]["reviewed_confidence"] == 0.55
    assert store["feedback"][0]["class_switched"] is True
    assert store["feedback"][0]["low_confidence_class_switch"] is True
    assert store["feedback"][0]["low_confidence_correct_feedback"] is False
    assert store["feedback"][0]["low_confidence_baked_feedback"] is True
    assert store["feedback"][0]["baked_confidence"] == expected_confidence


def test_low_confidence_correct_feedback_bakes_same_image_confidence(
    client,
    install_fake_model,
    isolated_feedback_store,
):
    install_fake_model([0.55, 0.2, 0.15, 0.06, 0.04])
    image_bytes = make_test_image_bytes()

    first_prediction = post_image(client, image_bytes).json()
    corrected_label = first_prediction["prediction"]
    assert corrected_label == main.DEFAULT_DISEASE_CLASS_NAMES[0]
    assert first_prediction["confidence"] == 0.55

    feedback_response = post_feedback(
        client,
        {
            "prediction_id": first_prediction["prediction_id"],
            "corrected_label": corrected_label,
            "is_correct": True,
        },
    )
    assert feedback_response.status_code == 200

    expected_confidence = main.deterministic_baked_confidence(
        first_prediction["image_hash"],
        corrected_label,
    )
    second_body = post_image(client, image_bytes).json()
    third_body = post_image(client, image_bytes).json()

    assert 0.75 <= expected_confidence <= 0.85
    assert second_body["prediction"] == corrected_label
    assert second_body["confidence"] == expected_confidence
    assert second_body["all_probabilities"][corrected_label] == expected_confidence
    assert second_body["top_predictions"][0] == {
        "class_name": corrected_label,
        "probability": expected_confidence,
    }
    assert third_body["confidence"] == expected_confidence
    assert third_body["all_probabilities"][corrected_label] == expected_confidence
    assert second_body["feedback_adjusted"]["adjusted_confidence"] == expected_confidence
    assert second_body["feedback_adjusted"]["base_class_probability"] == 0.55
    assert second_body["feedback_adjusted"]["confidence_strategy"] == "baked_low_confidence_correct_feedback"
    assert second_body["feedback_adjusted"]["low_confidence_class_switch"] is False
    assert second_body["feedback_adjusted"]["low_confidence_correct_feedback"] is True
    assert second_body["feedback_adjusted"]["low_confidence_baked_feedback"] is True
    assert second_body["feedback_adjusted"]["baked_confidence"] == expected_confidence

    store = json.loads(isolated_feedback_store.read_text())
    assert store["feedback"][0]["is_correct"] is True
    assert store["feedback"][0]["reviewed_prediction"] == corrected_label
    assert store["feedback"][0]["reviewed_confidence"] == 0.55
    assert store["feedback"][0]["class_switched"] is False
    assert store["feedback"][0]["low_confidence_class_switch"] is False
    assert store["feedback"][0]["low_confidence_correct_feedback"] is True
    assert store["feedback"][0]["low_confidence_baked_feedback"] is True
    assert store["feedback"][0]["baked_confidence"] == expected_confidence


def test_feedback_for_image_hash_applies_to_near_duplicate_upload(
    client,
    install_fake_model,
    isolated_feedback_store,
):
    install_fake_model([0.1, 0.7, 0.08, 0.07, 0.05])
    original_image = make_split_leaf_bytes(image_format="PNG")
    near_duplicate = make_split_leaf_bytes(image_format="JPEG")

    original_prediction = post_image(client, original_image).json()
    assert original_prediction["image_hash"] != main.compute_image_sha256(near_duplicate)

    corrected_label = main.DEFAULT_DISEASE_CLASS_NAMES[3]
    for token in ("user-a", "user-b", "user-c"):
        feedback_response = post_feedback(
            client,
            {
                "image_hash": original_prediction["image_hash"],
                "corrected_label": corrected_label,
                "is_correct": False,
            },
            token=token,
        )

        assert feedback_response.status_code == 200

    near_response = post_image(
        client,
        near_duplicate,
        filename="leaf.jpg",
        content_type="image/jpeg",
    )
    body = near_response.json()

    assert near_response.status_code == 200
    assert body["prediction"] == corrected_label
    assert body["confidence"] == body["feedback_adjusted"]["adjusted_confidence"]
    assert body["feedback_adjusted"]["applied"] is True
    assert body["feedback_adjusted"]["match_type"] == "near"
    assert body["feedback_adjusted"]["corrected_label"] == corrected_label
    assert body["feedback_adjusted"]["support_weight"] >= 1.2
    assert body["feedback_adjusted"]["base_class_probability"] == 0.07
    assert body["feedback_adjusted"]["source_image_hash"] == original_prediction["image_hash"]
    assert body["feedback_adjusted"]["distance"] <= main.config.FEEDBACK_NEAR_HASH_DISTANCE


def test_feedback_validates_corrected_label_against_runtime_classes(
    client,
    install_fake_model,
    isolated_feedback_store,
):
    install_fake_model([0.02, 0.02, 0.02, 0.04, 0.9])
    prediction = post_image(client, make_test_image_bytes()).json()

    invalid_response = post_feedback(
        client,
        {
            "image_hash": prediction["image_hash"],
            "corrected_label": "not_a_runtime_class",
            "is_correct": False,
        },
    )

    assert invalid_response.status_code == 400
    assert invalid_response.json()["detail"]["message"] == (
        "corrected_label is not a known class or unknown label"
    )

    unknown_response = post_feedback(
        client,
        {
            "image_hash": prediction["image_hash"],
            "corrected_label": main.config.UNKNOWN_LABEL,
            "is_correct": False,
        },
    )

    assert unknown_response.status_code == 200
    assert unknown_response.json()["feedback"]["corrected_label"] == main.config.UNKNOWN_LABEL


def test_repeated_feedback_from_same_user_replaces_previous_label(
    client,
    install_fake_model,
    isolated_feedback_store,
):
    install_fake_model([0.9, 0.03, 0.03, 0.02, 0.02])
    image_bytes = make_test_image_bytes()
    prediction = post_image(client, image_bytes).json()

    first_label = main.DEFAULT_DISEASE_CLASS_NAMES[2]
    second_label = main.DEFAULT_DISEASE_CLASS_NAMES[3]
    assert post_feedback(
        client,
        {
            "prediction_id": prediction["prediction_id"],
            "corrected_label": first_label,
            "is_correct": False,
        },
        token="same-user",
    ).status_code == 200
    assert post_feedback(
        client,
        {
            "prediction_id": prediction["prediction_id"],
            "corrected_label": second_label,
            "is_correct": False,
        },
        token="same-user",
    ).status_code == 200

    body = post_image(client, image_bytes).json()

    assert body["feedback_adjusted"]["applied"] is True
    assert body["feedback_adjusted"]["corrected_label"] == second_label
    assert body["feedback_adjusted"]["base_class_probability"] == 0.02
    assert body["feedback_adjusted"]["adjusted_confidence"] == 0.1

    store = json.loads(isolated_feedback_store.read_text())
    assert len(store["feedback"]) == 1
    assert store["feedback"][0]["corrected_label"] == second_label


def test_conflicting_exact_feedback_prevents_adjustment(
    client,
    install_fake_model,
    isolated_feedback_store,
):
    install_fake_model([0.9, 0.03, 0.03, 0.02, 0.02])
    image_bytes = make_test_image_bytes()
    prediction = post_image(client, image_bytes).json()

    assert post_feedback(
        client,
        {
            "prediction_id": prediction["prediction_id"],
            "corrected_label": main.DEFAULT_DISEASE_CLASS_NAMES[2],
            "is_correct": False,
        },
        token="user-a",
    ).status_code == 200
    assert post_feedback(
        client,
        {
            "prediction_id": prediction["prediction_id"],
            "corrected_label": main.DEFAULT_DISEASE_CLASS_NAMES[3],
            "is_correct": False,
        },
        token="user-b",
    ).status_code == 200

    body = post_image(client, image_bytes).json()

    assert body["feedback_adjusted"]["applied"] is False
    assert body["feedback_adjusted"]["match_type"] == "exact"
    assert body["feedback_adjusted"]["consensus"] == 0.5


def test_feedback_requires_image_when_training_consent_is_enabled(
    client,
    install_fake_model,
    isolated_feedback_store,
):
    install_fake_model([0.9, 0.03, 0.03, 0.02, 0.02])
    prediction = post_image(client, make_test_image_bytes()).json()

    response = post_feedback(
        client,
        {
            "prediction_id": prediction["prediction_id"],
            "corrected_label": prediction["prediction"],
            "is_correct": True,
            "training_consent": True,
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "file is required when training_consent is true"
