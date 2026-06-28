
from fastapi import FastAPI, File, Form, Header, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel
from contextlib import asynccontextmanager, contextmanager
from PIL import Image, ImageOps
import hashlib
import json
import numpy as np
import tensorflow as tf
from tensorflow import keras
from io import BytesIO
import logging
from typing import Dict, Any, List, Optional, Tuple
import os
from pathlib import Path
import re
import tempfile
from datetime import datetime, timezone
from threading import Lock

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
APP_ROOT = Path(__file__).resolve().parent

# Configuration
def normalize_origin(value: str) -> str:
    """Normalize env-provided origin values to browser Origin format."""
    return value.strip().strip('"').strip("'").rstrip("/")


def parse_cors_origins(value: str) -> list:
    if not value:
        return ["*"]
    origins = [normalize_origin(item) for item in value.split(",") if item.strip()]
    return origins or ["*"]


def parse_class_names(value: Optional[str]) -> Optional[List[str]]:
    """Parse optional comma-separated class names from env."""
    if not value:
        return None
    class_names = [item.strip() for item in value.split(",") if item.strip()]
    return class_names or None


def load_class_names_file(path_value: Optional[str]) -> Optional[List[str]]:
    """Load class names from a JSON artifact file when available."""
    if not path_value:
        return None

    path = Path(path_value)
    if not path.is_absolute():
        path = APP_ROOT / path

    if not path.exists():
        logger.warning("Class names file does not exist: %s", path)
        return None

    try:
        class_names = json.loads(path.read_text())
    except Exception as exc:
        logger.warning("Failed to read class names file %s: %s", path, exc)
        return None

    if not isinstance(class_names, list) or not all(isinstance(item, str) for item in class_names):
        logger.warning("Invalid class names file format: %s", path)
        return None

    return class_names or None


DEFAULT_DISEASE_CLASS_NAMES = [
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot",
    "Corn_(maize)___Common_rust_",
    "Corn_(maize)___Northern_Leaf_Blight",
    "Corn_(maize)___healthy",
]
DEFAULT_UNKNOWN_CLASS_NAME = "unknown_unclassified"
UNKNOWN_KERAS_KWARGS_RE = re.compile(
    r"Unrecognized keyword arguments passed to [^:]+: (?P<kwargs>\{.*\})"
)

DISEASE_GUIDANCE: Dict[str, Dict[str, str]] = {
    "Corn_(maize)___healthy": {
        "title": "Healthy Leaf",
        "description": "No visible signs of major maize leaf disease.",
        "treatment": (
            "No treatment is needed right now. Keep scouting the field and "
            "respond quickly if new lesions or pustules begin to appear."
        ),
        "prevention": (
            "Maintain regular field scouting, choose hybrids with good disease "
            "resistance for your area, and keep overall crop stress low with "
            "sound agronomic management."
        ),
    },
    "Corn_(maize)___Northern_Leaf_Blight": {
        "title": "Northern Leaf Blight",
        "description": (
            "Fungal disease with elongated gray-green lesions that reduce yield."
        ),
        "treatment": (
            "Apply a labeled foliar fungicide when disease is active and moving "
            "up the canopy, especially near tasseling to silking (VT-R1). This "
            "disease often starts from infected corn residue, so protecting the "
            "ear leaf and the leaves above it is the main treatment goal."
        ),
        "prevention": (
            "Use hybrids with strong Northern Leaf Blight resistance, including "
            "partial resistance or suitable Ht-gene resistance where available. "
            "Rotate away from corn and manage corn residue where practical, "
            "since the fungus survives in old corn debris and can restart in "
            "the field the next season."
        ),
    },
    "Corn_(maize)___Common_rust_": {
        "title": "Common Rust",
        "description": (
            "Reddish-brown pustules caused by rust fungi on both leaf surfaces."
        ),
        "treatment": (
            "If rust is increasing early on susceptible corn, apply a labeled "
            "foliar fungicide while pustules are still limited. Treatment is "
            "most worthwhile when cool, humid weather is helping the disease "
            "build and the upper canopy still needs protection."
        ),
        "prevention": (
            "Prioritize resistant hybrids first. Unlike residue-borne leaf "
            "diseases, crop rotation and residue management are much less useful "
            "for common rust because spores usually blow in from outside the "
            "field rather than surviving locally."
        ),
    },
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot": {
        "title": "Gray Leaf Spot",
        "description": (
            "Rectangular gray lesions that often expand along leaf veins."
        ),
        "treatment": (
            "Apply a labeled foliar fungicide promptly when Gray Leaf Spot is "
            "active, particularly from tasseling to early silking (VT-R1) in "
            "humid weather or in fields with a history of the disease. "
            "Treatment is especially important when lesions are approaching the "
            "ear leaf and upper canopy."
        ),
        "prevention": (
            "Use resistant hybrids, avoid continuous corn where possible, and "
            "manage infested corn residue because this disease commonly carries "
            "over in corn-on-corn systems. Pay extra attention in warm, humid "
            "fields, since Gray Leaf Spot is strongly favored by long periods "
            "of moisture and high humidity."
        ),
    },
}

UNKNOWN_GUIDANCE = {
    "title": "Image Rejected",
    "description": (
        "This image does not look like a confident match for the trained maize "
        "disease classes."
    ),
    "treatment": (
        "Retake the photo so a single maize leaf fills most of the frame. Avoid "
        "blur, heavy shadows, and unrelated background objects."
    ),
    "prevention": (
        "Use a clear field photo of a maize leaf from the front, and add "
        "non-maize images to training if you want the model to reject them "
        "reliably."
    ),
}


class Config:
    DEFAULT_MODEL_PATH = Path(__file__).resolve().parent / "best_model.keras"
    DEFAULT_CLASS_NAMES_PATH = Path(__file__).resolve().parent / "class_names.json"
    MODEL_PATH = os.getenv(
        "MODEL_PATH",
        str(DEFAULT_MODEL_PATH)
    )  # Use .keras format (Keras 3 native)
    IMG_SIZE = (224, 224)
    MAX_IMAGE_SIZE_MB = 10
    CORS_ORIGINS = parse_cors_origins(os.getenv("CORS_ORIGINS", "*"))
    CLASS_NAMES = parse_class_names(os.getenv("CLASS_NAMES")) or load_class_names_file(
        os.getenv("CLASS_NAMES_PATH", str(DEFAULT_CLASS_NAMES_PATH))
    )
    UNKNOWN_LABEL = os.getenv("UNKNOWN_LABEL", "Unknown / not confidently maize")
    UNKNOWN_CLASS_NAME = os.getenv("UNKNOWN_CLASS_NAME", DEFAULT_UNKNOWN_CLASS_NAME)
    LIKELY_CONFIDENCE_THRESHOLD = float(os.getenv("LIKELY_CONFIDENCE_THRESHOLD", "0.50"))
    CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", "0.75"))
    MARGIN_THRESHOLD = float(os.getenv("MARGIN_THRESHOLD", "0.20"))
    ENTROPY_THRESHOLD = float(os.getenv("ENTROPY_THRESHOLD", "0.70"))
    FEEDBACK_STORE_PATH = os.getenv(
        "FEEDBACK_STORE_PATH",
        str(Path(tempfile.gettempdir()) / "maize-detection-feedback-store.json"),
    )
    FEEDBACK_NEAR_HASH_DISTANCE = int(os.getenv("FEEDBACK_NEAR_HASH_DISTANCE", "6"))
    FEEDBACK_MATCH_CANDIDATE_LIMIT = int(os.getenv("FEEDBACK_MATCH_CANDIDATE_LIMIT", "500"))
    FEEDBACK_EXACT_CONSENSUS_THRESHOLD = float(os.getenv("FEEDBACK_EXACT_CONSENSUS_THRESHOLD", "0.60"))
    FEEDBACK_NEAR_CONSENSUS_THRESHOLD = float(os.getenv("FEEDBACK_NEAR_CONSENSUS_THRESHOLD", "0.80"))
    FEEDBACK_NEAR_SUPPORT_THRESHOLD = float(os.getenv("FEEDBACK_NEAR_SUPPORT_THRESHOLD", "1.20"))
    FEEDBACK_NEAR_BASE_WEIGHT = float(os.getenv("FEEDBACK_NEAR_BASE_WEIGHT", "0.60"))
    FEEDBACK_MAX_BOOST_PER_SUPPORT = float(os.getenv("FEEDBACK_MAX_BOOST_PER_SUPPORT", "0.08"))
    FEEDBACK_MAX_TRUSTED_SUPPORT = float(os.getenv("FEEDBACK_MAX_TRUSTED_SUPPORT", "3.0"))
    FEEDBACK_MAX_CONFIDENCE = float(os.getenv("FEEDBACK_MAX_CONFIDENCE", "0.95"))
    FEEDBACK_BAKED_LOW_CONFIDENCE_THRESHOLD = float(os.getenv("FEEDBACK_BAKED_LOW_CONFIDENCE_THRESHOLD", "0.60"))
    FEEDBACK_BAKED_MIN_CONFIDENCE = float(os.getenv("FEEDBACK_BAKED_MIN_CONFIDENCE", "0.75"))
    FEEDBACK_BAKED_MAX_CONFIDENCE = float(os.getenv("FEEDBACK_BAKED_MAX_CONFIDENCE", "0.85"))
    MODEL_VERSION = os.getenv("MODEL_VERSION", "full_v1")
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    SUPABASE_FEEDBACK_BUCKET = os.getenv("SUPABASE_FEEDBACK_BUCKET", "feedback-images")
    
config = Config()
logger.info(f"CORS origins configured: {config.CORS_ORIGINS}")

# Global state
class ModelState:
    model: keras.Model = None
    class_names: list = None

state = ModelState()

FEEDBACK_STORE_VERSION = 1
PREDICTION_ID_PREFIX = "sha256:"
SHA256_HEX_RE = re.compile(r"^[a-fA-F0-9]{64}$")
feedback_store_lock = Lock()
supabase_client = None


class FeedbackRequest(BaseModel):
    prediction_id: Optional[str] = None
    image_hash: Optional[str] = None
    corrected_label: str
    is_correct: bool
    training_consent: bool = False


def is_supabase_feedback_enabled() -> bool:
    return bool(config.SUPABASE_URL and config.SUPABASE_SERVICE_ROLE_KEY)


def get_supabase_client():
    global supabase_client

    if not is_supabase_feedback_enabled():
        return None

    if supabase_client is not None:
        return supabase_client

    try:
        from supabase import create_client
    except Exception as exc:
        logger.warning("Supabase feedback storage is configured but the client is unavailable: %s", exc)
        return None

    supabase_client = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY)
    return supabase_client


def extract_bearer_token(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None

    value = authorization.strip()
    if not value:
        return None

    scheme, _, token = value.partition(" ")
    if scheme.lower() == "bearer" and token.strip():
        return token.strip()

    return value


def local_user_id_from_token(token: Optional[str], *, required: bool) -> Optional[str]:
    if token:
        digest = hashlib.sha256(token.encode("utf-8")).hexdigest()[:16]
        return f"local:{digest}"
    return "local-user" if required else None


def resolve_authenticated_user_id(
    authorization: Optional[str],
    *,
    required: bool,
) -> Optional[str]:
    token = extract_bearer_token(authorization)
    client = get_supabase_client()

    if client is None:
        return local_user_id_from_token(token, required=required)

    if not token:
        if required:
            raise HTTPException(status_code=401, detail="Authentication is required to submit feedback")
        return None

    try:
        response = client.auth.get_user(token)
        user = getattr(response, "user", None)
        if user is None:
            data = getattr(response, "data", None)
            user = getattr(data, "user", None) if data is not None else None
        user_id = getattr(user, "id", None)
        if user_id is None and isinstance(user, dict):
            user_id = user.get("id")
    except Exception as exc:
        logger.warning("Supabase auth token verification failed: %s", exc)
        raise HTTPException(status_code=401, detail="Invalid authentication token") from exc

    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid authentication token")

    return str(user_id)


def _extract_unknown_keras_kwargs(error: Exception) -> List[str]:
    """Extract unsupported serialized kwarg names from Keras deserialization errors."""
    match = UNKNOWN_KERAS_KWARGS_RE.search(str(error))
    if not match:
        return []
    return re.findall(r"'([^']+)'\s*:", match.group("kwargs"))


@contextmanager
def keras_deserialization_compatibility():
    """
    Strip newer serialized config keys that this Keras runtime does not accept.

    The fine-tuned model was saved by a newer Keras build that emits fields such
    as `value_range` on RandomContrast and `quantization_config` on Dense.
    """
    try:
        from keras.src.ops.operation import Operation
    except Exception:
        yield
        return

    original_from_config = Operation.from_config.__func__
    logged_keys = set()

    @classmethod
    def compat_from_config(cls, config):
        current_config = dict(config)
        while True:
            try:
                return cls(**current_config)
            except (TypeError, ValueError) as exc:
                unknown_keys = tuple(
                    key for key in _extract_unknown_keras_kwargs(exc)
                    if key in current_config
                )
                if not unknown_keys:
                    raise

                for key in unknown_keys:
                    current_config.pop(key, None)

                marker = (cls.__name__, unknown_keys)
                if marker not in logged_keys:
                    logged_keys.add(marker)
                    logger.warning(
                        "Ignoring unsupported serialized Keras config keys for %s: %s",
                        cls.__name__,
                        list(unknown_keys),
                    )

    Operation.from_config = compat_from_config
    try:
        yield
    finally:
        Operation.from_config = classmethod(original_from_config)


def load_model_with_compatibility(model_path: str) -> keras.Model:
    """Load a Keras model while tolerating newer config keys when possible."""
    with keras_deserialization_compatibility():
        return keras.models.load_model(model_path, compile=False)


def default_class_names_for_output_units(output_units: int) -> Optional[List[str]]:
    """Return built-in class names for known model heads."""
    if output_units == 4:
        return list(DEFAULT_DISEASE_CLASS_NAMES)
    if output_units == 5:
        return [*DEFAULT_DISEASE_CLASS_NAMES, config.UNKNOWN_CLASS_NAME]
    return None


def resolve_class_names(output_units: int) -> List[str]:
    """Resolve class names from env override or known model output sizes."""
    if config.CLASS_NAMES:
        if len(config.CLASS_NAMES) != output_units:
            raise ValueError(
                "Configured class names do not match model outputs. "
                f"Model outputs: {output_units}, class names: {len(config.CLASS_NAMES)}."
            )
        return config.CLASS_NAMES

    class_names = default_class_names_for_output_units(output_units)
    if class_names is None:
        raise ValueError(
            "Unable to infer class names for this model. "
            f"Model outputs: {output_units}. Set CLASS_NAMES to match training order."
        )
    return class_names


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager - handles startup and shutdown
    Industry best practice instead of deprecated @app.on_event
    """
    # Startup: Load model once
    logger.info("="*60)
    logger.info("Starting Maize Disease Detection API")
    logger.info("="*60)
    
    try:
        logger.info(f"Loading model from: {config.MODEL_PATH}")
        
        # Load model using Keras 3 native format
        state.model = load_model_with_compatibility(config.MODEL_PATH)
        output_units = int(state.model.output_shape[-1])
        state.class_names = resolve_class_names(output_units)
        
        logger.info("✓ Model loaded successfully")
        logger.info(f"✓ Classes: {len(state.class_names)}")
        logger.info(f"✓ Class order: {state.class_names}")
        logger.info(f"✓ TensorFlow version: {tf.__version__}")
        logger.info(f"✓ Keras version: {keras.__version__}")
        logger.info("="*60)
        
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        raise RuntimeError(f"Model initialization failed: {e}")
    
    yield  # Server runs here
    
    # Shutdown: Cleanup
    logger.info("Shutting down Maize Disease API")
    state.model = None


# Initialize FastAPI with lifespan
app = FastAPI(
    title="Maize Disease Detection API",
    description="AI-powered corn disease classification",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Production middleware
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def validate_image_size(file_size: int) -> None:
    """Validate uploaded file size"""
    max_size = config.MAX_IMAGE_SIZE_MB * 1024 * 1024
    if file_size > max_size:
        raise HTTPException(
            status_code=413,
            detail=f"Image too large. Max size: {config.MAX_IMAGE_SIZE_MB}MB"
        )


def preprocess_image(image_bytes: bytes) -> np.ndarray:
    """
    Preprocess image for model inference
    
    Note: Model includes Rescaling layer, so no manual normalization needed
    """
    try:
        # Respect EXIF orientation from phone cameras before conversion.
        image = Image.open(BytesIO(image_bytes))
        image = ImageOps.exif_transpose(image).convert("RGB")
        
        # Resize to model input size
        image = image.resize(config.IMG_SIZE, Image.Resampling.BILINEAR)
        
        # Convert to array and add batch dimension
        image_array = np.array(image, dtype=np.float32)
        image_array = np.expand_dims(image_array, axis=0)
        
        return image_array
        
    except Exception as e:
        logger.error(f"Image preprocessing failed: {e}")
        raise HTTPException(
            status_code=400,
            detail=f"Invalid image: {str(e)}"
        )


def compute_image_sha256(image_bytes: bytes) -> str:
    """Return a deterministic SHA-256 digest for the uploaded image bytes."""
    return hashlib.sha256(image_bytes).hexdigest()


def compute_perceptual_hash(image_bytes: bytes) -> str:
    """Return a compact average-hash signature for near-duplicate matching."""
    try:
        image = Image.open(BytesIO(image_bytes))
        image = ImageOps.exif_transpose(image).convert("L")
        image = image.resize((8, 8), Image.Resampling.LANCZOS)
        pixels = np.array(image, dtype=np.float32)
    except Exception as exc:
        logger.error("Image perceptual hash failed: %s", exc)
        raise HTTPException(
            status_code=400,
            detail=f"Invalid image: {str(exc)}"
        )

    threshold = float(pixels.mean())
    bits = pixels >= threshold
    value = 0
    for bit in bits.flatten():
        value = (value << 1) | int(bool(bit))
    return f"{value:016x}"


def hamming_distance_hex(left: str, right: str) -> int:
    """Return the bit distance between equal-width hexadecimal signatures."""
    if len(left) != len(right):
        return max(len(left), len(right)) * 4
    return bin(int(left, 16) ^ int(right, 16)).count("1")


def build_prediction_id(image_hash: str) -> str:
    return f"{PREDICTION_ID_PREFIX}{image_hash}"


def image_hash_from_prediction_id(prediction_id: Optional[str]) -> Optional[str]:
    if not prediction_id or not prediction_id.startswith(PREDICTION_ID_PREFIX):
        return None
    value = prediction_id[len(PREDICTION_ID_PREFIX):]
    if SHA256_HEX_RE.fullmatch(value):
        return value.lower()
    return None


def get_feedback_store_path() -> Path:
    return Path(os.getenv("FEEDBACK_STORE_PATH") or config.FEEDBACK_STORE_PATH)


def empty_feedback_store() -> Dict[str, Any]:
    return {
        "version": FEEDBACK_STORE_VERSION,
        "predictions": {},
        "feedback": [],
    }


def normalize_feedback_store(data: Any) -> Dict[str, Any]:
    if not isinstance(data, dict):
        return empty_feedback_store()

    predictions = data.get("predictions")
    feedback = data.get("feedback")
    return {
        "version": FEEDBACK_STORE_VERSION,
        "predictions": predictions if isinstance(predictions, dict) else {},
        "feedback": feedback if isinstance(feedback, list) else [],
    }


def load_feedback_store() -> Dict[str, Any]:
    path = get_feedback_store_path()
    if not path.exists():
        return empty_feedback_store()

    try:
        return normalize_feedback_store(json.loads(path.read_text()))
    except Exception as exc:
        logger.warning("Failed to read feedback store %s: %s", path, exc)
        return empty_feedback_store()


def save_feedback_store(store: Dict[str, Any]) -> None:
    path = get_feedback_store_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_name(f".{path.name}.tmp")
    tmp_path.write_text(json.dumps(store, indent=2, sort_keys=True))
    os.replace(tmp_path, path)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def valid_feedback_labels() -> List[str]:
    runtime_class_names = state.class_names or config.CLASS_NAMES
    labels = set(runtime_class_names or [*DEFAULT_DISEASE_CLASS_NAMES, config.UNKNOWN_CLASS_NAME])
    labels.update({config.UNKNOWN_CLASS_NAME, config.UNKNOWN_LABEL, DEFAULT_UNKNOWN_CLASS_NAME})
    return sorted(labels)


def validate_feedback_label(label: str) -> str:
    normalized_label = label.strip()
    valid_labels = valid_feedback_labels()
    if normalized_label not in valid_labels:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "corrected_label is not a known class or unknown label",
                "valid_labels": valid_labels,
            },
        )
    return normalized_label


def validate_image_hash_value(image_hash: str) -> str:
    normalized_hash = image_hash.strip().lower()
    if not SHA256_HEX_RE.fullmatch(normalized_hash):
        raise HTTPException(
            status_code=400,
            detail="image_hash must be a 64-character SHA-256 hex digest",
        )
    return normalized_hash


def find_local_prediction_record(
    store: Dict[str, Any],
    *,
    prediction_id: Optional[str],
    image_hash: Optional[str],
) -> Optional[Dict[str, Any]]:
    predictions = store.get("predictions", {})
    if prediction_id:
        record = predictions.get(prediction_id)
        if isinstance(record, dict):
            return record

    if image_hash:
        matching_records = [
            record for record in predictions.values()
            if isinstance(record, dict) and record.get("image_hash") == image_hash
        ]
        if matching_records:
            return max(matching_records, key=lambda item: item.get("created_at", ""))

    return None


def feedback_id_for_entry(entry: Dict[str, Any]) -> str:
    payload = json.dumps(
        {
            "image_hash": entry.get("image_hash"),
            "corrected_label": entry.get("corrected_label"),
            "is_correct": entry.get("is_correct"),
            "created_at": entry.get("created_at"),
        },
        sort_keys=True,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]


def normalize_supabase_data(response: Any) -> List[Dict[str, Any]]:
    data = getattr(response, "data", None)
    if isinstance(data, list):
        return [item for item in data if isinstance(item, dict)]
    if isinstance(data, dict):
        return [data]
    return []


def select_supabase_prediction(
    *,
    prediction_id: Optional[str],
    image_hash: Optional[str],
) -> Optional[Dict[str, Any]]:
    client = get_supabase_client()
    if client is None:
        return None

    try:
        if prediction_id:
            response = (
                client.table("detection_predictions")
                .select("*")
                .eq("prediction_id", prediction_id)
                .limit(1)
                .execute()
            )
        elif image_hash:
            response = (
                client.table("detection_predictions")
                .select("*")
                .eq("image_hash", image_hash)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
        else:
            return None
    except Exception as exc:
        logger.warning("Failed to read Supabase prediction feedback record: %s", exc)
        return None

    records = normalize_supabase_data(response)
    return records[0] if records else None


def select_feedback_prediction_record(
    *,
    prediction_id: Optional[str],
    image_hash: Optional[str],
) -> Optional[Dict[str, Any]]:
    if get_supabase_client() is not None:
        return select_supabase_prediction(prediction_id=prediction_id, image_hash=image_hash)

    with feedback_store_lock:
        store = load_feedback_store()
        return find_local_prediction_record(
            store,
            prediction_id=prediction_id,
            image_hash=image_hash,
        )


def record_prediction_for_feedback(
    *,
    prediction_id: str,
    image_hash: str,
    perceptual_hash: str,
    filename: Optional[str],
    content_type: Optional[str],
    user_id: Optional[str],
    summary: Dict[str, Any],
    feedback_adjusted: Dict[str, Any],
) -> Optional[str]:
    record = {
        "prediction_id": prediction_id,
        "user_id": user_id,
        "image_hash": image_hash,
        "perceptual_hash": perceptual_hash,
        "filename": filename,
        "content_type": content_type,
        "model_version": config.MODEL_VERSION,
        "prediction": summary["prediction"],
        "model_prediction": summary["model_prediction"],
        "confidence": summary["confidence"],
        "decision": summary["decision"],
        "margin": summary.get("margin"),
        "normalized_entropy": summary.get("normalized_entropy"),
        "all_probabilities": summary.get("all_probabilities"),
        "feedback_adjusted": feedback_adjusted,
        "created_at": utc_now_iso(),
    }

    client = get_supabase_client()
    if client is not None:
        try:
            response = (
                client.table("detection_predictions")
                .upsert(record, on_conflict="prediction_id")
                .execute()
            )
            rows = normalize_supabase_data(response)
            if rows:
                return rows[0].get("id")
        except Exception as exc:
            logger.warning("Failed to record Supabase prediction feedback signature: %s", exc)
        return None

    try:
        with feedback_store_lock:
            store = load_feedback_store()
            store["predictions"][prediction_id] = record
            save_feedback_store(store)
    except Exception as exc:
        logger.warning("Failed to record prediction feedback signature: %s", exc)
        return None

    return prediction_id


def upload_feedback_image_to_supabase(
    *,
    user_id: str,
    image_hash: str,
    file_bytes: bytes,
    filename: Optional[str],
    content_type: Optional[str],
) -> Optional[str]:
    client = get_supabase_client()
    if client is None:
        return None

    safe_user_id = re.sub(r"[^a-zA-Z0-9_-]+", "-", user_id).strip("-") or "user"
    suffix = Path(filename or "feedback-image").suffix.lower()
    if suffix not in {".jpg", ".jpeg", ".png", ".webp"}:
        suffix = ".jpg" if content_type == "image/jpeg" else ".png"
    object_path = f"feedback/{safe_user_id}/{image_hash}{suffix}"

    try:
        bucket = client.storage.from_(config.SUPABASE_FEEDBACK_BUCKET)
        bucket.upload(
            object_path,
            file_bytes,
            {
                "content-type": content_type or "application/octet-stream",
                "upsert": "true",
            },
        )
    except Exception as exc:
        logger.warning("Failed to upload consented feedback image to Supabase Storage: %s", exc)
        raise HTTPException(status_code=502, detail="Could not save feedback image") from exc

    return object_path


def is_unknown_feedback_label(label: Optional[str]) -> bool:
    return label in {config.UNKNOWN_LABEL, config.UNKNOWN_CLASS_NAME, DEFAULT_UNKNOWN_CLASS_NAME}


def normalized_feedback_prediction_label(label: Optional[str]) -> Optional[str]:
    if label is None:
        return None
    if is_unknown_feedback_label(label):
        return config.UNKNOWN_CLASS_NAME
    return label


def deterministic_baked_confidence(image_hash: str, corrected_label: str) -> float:
    min_confidence = min(config.FEEDBACK_BAKED_MIN_CONFIDENCE, config.FEEDBACK_BAKED_MAX_CONFIDENCE)
    max_confidence = max(config.FEEDBACK_BAKED_MIN_CONFIDENCE, config.FEEDBACK_BAKED_MAX_CONFIDENCE)
    if max_confidence <= min_confidence:
        return round(min_confidence, 4)

    seed = f"{image_hash}:{corrected_label}:low-confidence-class-switch"
    bucket = int(hashlib.sha256(seed.encode("utf-8")).hexdigest()[:8], 16) % 10001
    confidence = min_confidence + ((max_confidence - min_confidence) * (bucket / 10000))
    return round(confidence, 4)


def prediction_record_bake_reference_confidence(prediction_record: Dict[str, Any]) -> Optional[float]:
    feedback_metadata = prediction_record.get("feedback_adjusted")
    if isinstance(feedback_metadata, str):
        try:
            feedback_metadata = json.loads(feedback_metadata)
        except json.JSONDecodeError:
            feedback_metadata = None

    if isinstance(feedback_metadata, dict) and feedback_metadata.get("raw_confidence") is not None:
        try:
            return float(feedback_metadata["raw_confidence"])
        except (TypeError, ValueError):
            pass

    try:
        return float(prediction_record.get("confidence"))
    except (TypeError, ValueError):
        return None


def feedback_is_low_confidence_class_switch(
    *,
    prediction_record: Dict[str, Any],
    corrected_label: str,
) -> bool:
    if is_unknown_feedback_label(corrected_label):
        return False

    reviewed_prediction = normalized_feedback_prediction_label(prediction_record.get("prediction"))
    corrected_prediction = normalized_feedback_prediction_label(corrected_label)
    if not reviewed_prediction or reviewed_prediction == corrected_prediction:
        return False

    reviewed_confidence = prediction_record_bake_reference_confidence(prediction_record)
    if reviewed_confidence is None:
        return False

    return reviewed_confidence < config.FEEDBACK_BAKED_LOW_CONFIDENCE_THRESHOLD


def feedback_is_low_confidence_correct_prediction(
    *,
    prediction_record: Dict[str, Any],
    corrected_label: str,
    is_correct: bool,
) -> bool:
    if not is_correct or is_unknown_feedback_label(corrected_label):
        return False

    reviewed_prediction = normalized_feedback_prediction_label(prediction_record.get("prediction"))
    corrected_prediction = normalized_feedback_prediction_label(corrected_label)
    if not reviewed_prediction or reviewed_prediction != corrected_prediction:
        return False

    reviewed_confidence = prediction_record_bake_reference_confidence(prediction_record)
    if reviewed_confidence is None:
        return False

    return reviewed_confidence < config.FEEDBACK_BAKED_LOW_CONFIDENCE_THRESHOLD


def upsert_feedback_entry(
    *,
    prediction_record: Dict[str, Any],
    feedback: FeedbackRequest,
    user_id: str,
    image_object_path: Optional[str],
) -> Dict[str, Any]:
    now = utc_now_iso()
    public_prediction_id = prediction_record.get("prediction_id") or feedback.prediction_id
    image_hash = validate_image_hash_value(prediction_record["image_hash"])
    reviewed_prediction = prediction_record.get("prediction")
    reviewed_confidence = prediction_record.get("confidence")
    class_switched = normalized_feedback_prediction_label(reviewed_prediction) != normalized_feedback_prediction_label(
        feedback.corrected_label
    )
    low_confidence_class_switch = feedback_is_low_confidence_class_switch(
        prediction_record=prediction_record,
        corrected_label=feedback.corrected_label,
    )
    low_confidence_correct_feedback = feedback_is_low_confidence_correct_prediction(
        prediction_record=prediction_record,
        corrected_label=feedback.corrected_label,
        is_correct=bool(feedback.is_correct),
    )
    low_confidence_baked_feedback = low_confidence_class_switch or low_confidence_correct_feedback
    baked_confidence = (
        deterministic_baked_confidence(image_hash, feedback.corrected_label)
        if low_confidence_baked_feedback
        else None
    )
    entry = {
        "prediction_id": public_prediction_id,
        "prediction_record_id": prediction_record.get("id") or public_prediction_id,
        "user_id": user_id,
        "image_hash": image_hash,
        "perceptual_hash": prediction_record.get("perceptual_hash"),
        "corrected_label": feedback.corrected_label,
        "is_correct": bool(feedback.is_correct),
        "reviewed_prediction": reviewed_prediction,
        "reviewed_confidence": reviewed_confidence,
        "class_switched": bool(class_switched),
        "low_confidence_class_switch": low_confidence_class_switch,
        "low_confidence_correct_feedback": low_confidence_correct_feedback,
        "low_confidence_baked_feedback": low_confidence_baked_feedback,
        "baked_confidence": baked_confidence,
        "training_consent": bool(feedback.training_consent),
        "image_object_path": image_object_path,
        "updated_at": now,
    }

    client = get_supabase_client()
    if client is not None:
        supabase_entry = {
            "prediction_id": prediction_record.get("id"),
            "user_id": user_id,
            "image_hash": image_hash,
            "perceptual_hash": prediction_record.get("perceptual_hash"),
            "corrected_label": feedback.corrected_label,
            "is_correct": bool(feedback.is_correct),
            "reviewed_prediction": reviewed_prediction,
            "reviewed_confidence": reviewed_confidence,
            "class_switched": bool(class_switched),
            "low_confidence_class_switch": low_confidence_class_switch,
            "low_confidence_correct_feedback": low_confidence_correct_feedback,
            "low_confidence_baked_feedback": low_confidence_baked_feedback,
            "baked_confidence": baked_confidence,
            "training_consent": bool(feedback.training_consent),
            "image_object_path": image_object_path,
            "updated_at": now,
        }

        if not supabase_entry["prediction_id"]:
            raise HTTPException(status_code=404, detail="No stored prediction was found for prediction_id")

        try:
            response = (
                client.table("detection_feedback")
                .upsert(supabase_entry, on_conflict="prediction_id,user_id")
                .execute()
            )
            rows = normalize_supabase_data(response)
            if rows:
                row = rows[0]
                row["prediction_public_id"] = public_prediction_id
                row["feedback_id"] = row.get("id")
                return row
        except Exception as exc:
            logger.warning("Failed to persist Supabase feedback entry: %s", exc)
            raise HTTPException(status_code=502, detail="Could not save feedback") from exc

    with feedback_store_lock:
        store = load_feedback_store()
        existing_index = None
        for index, item in enumerate(store["feedback"]):
            if not isinstance(item, dict):
                continue
            if item.get("prediction_id") == public_prediction_id and item.get("user_id") == user_id:
                existing_index = index
                break

        if existing_index is not None:
            existing = store["feedback"][existing_index]
            entry["created_at"] = existing.get("created_at", now)
            entry["feedback_id"] = existing.get("feedback_id") or feedback_id_for_entry(entry)
            store["feedback"][existing_index] = entry
        else:
            entry["created_at"] = now
            entry["feedback_id"] = feedback_id_for_entry(entry)
            store["feedback"].append(entry)

        save_feedback_store(store)

    return entry


def load_feedback_entries(limit: Optional[int] = None) -> List[Dict[str, Any]]:
    candidate_limit = limit or config.FEEDBACK_MATCH_CANDIDATE_LIMIT
    client = get_supabase_client()
    if client is not None:
        try:
            response = (
                client.table("detection_feedback")
                .select("*")
                .order("updated_at", desc=True)
                .limit(candidate_limit)
                .execute()
            )
            return normalize_supabase_data(response)
        except Exception as exc:
            logger.warning("Failed to load Supabase feedback entries: %s", exc)
            return []

    with feedback_store_lock:
        feedback_entries = load_feedback_store().get("feedback", [])

    entries = [entry for entry in feedback_entries if isinstance(entry, dict)]
    return sorted(
        entries,
        key=lambda entry: entry.get("updated_at") or entry.get("created_at") or "",
        reverse=True,
    )[:candidate_limit]


def feedback_label_to_probability_key(label: str, summary: Dict[str, Any]) -> str:
    unknown_labels = {config.UNKNOWN_LABEL, config.UNKNOWN_CLASS_NAME, DEFAULT_UNKNOWN_CLASS_NAME}
    if label in unknown_labels:
        return config.UNKNOWN_CLASS_NAME
    if label in summary.get("all_probabilities", {}):
        return label
    return label


def feedback_label_to_display_prediction(label: str) -> str:
    if label in {config.UNKNOWN_LABEL, config.UNKNOWN_CLASS_NAME, DEFAULT_UNKNOWN_CLASS_NAME}:
        return config.UNKNOWN_LABEL
    return label


def feedback_label_decision(label: str, match_type: str) -> str:
    if label in {config.UNKNOWN_LABEL, config.UNKNOWN_CLASS_NAME, DEFAULT_UNKNOWN_CLASS_NAME}:
        return "rejected"
    return "accepted" if match_type == "exact" else "likely"


def feedback_entry_time(entry: Dict[str, Any]) -> str:
    return str(entry.get("updated_at") or entry.get("created_at") or "")


def feedback_candidate_weight(match_type: str, distance: int) -> float:
    if match_type == "exact":
        return 1.0

    threshold = max(config.FEEDBACK_NEAR_HASH_DISTANCE, 0)
    weight = config.FEEDBACK_NEAR_BASE_WEIGHT * (1 - (distance / (threshold + 1)))
    return max(0.0, round(weight, 6))


def build_feedback_candidate(
    entry: Dict[str, Any],
    *,
    image_hash: str,
    perceptual_hash: str,
) -> Optional[Dict[str, Any]]:
    if entry.get("image_hash") == image_hash:
        return {
            **entry,
            "match_type": "exact",
            "distance": 0,
            "weight": feedback_candidate_weight("exact", 0),
        }

    entry_perceptual_hash = entry.get("perceptual_hash")
    if not entry_perceptual_hash or not perceptual_hash:
        return None

    try:
        distance = hamming_distance_hex(perceptual_hash, entry_perceptual_hash)
    except ValueError:
        return None

    if distance > config.FEEDBACK_NEAR_HASH_DISTANCE:
        return None

    return {
        **entry,
        "match_type": "near",
        "distance": distance,
        "weight": feedback_candidate_weight("near", distance),
    }


def dedupe_feedback_candidates(candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    latest_by_user_image: Dict[Tuple[str, str], Dict[str, Any]] = {}
    for candidate in candidates:
        image_hash = candidate.get("image_hash")
        if not image_hash:
            continue
        user_key = str(candidate.get("user_id") or candidate.get("feedback_id") or candidate.get("id") or "anonymous")
        key = (user_key, image_hash)
        existing = latest_by_user_image.get(key)
        if existing is None or feedback_entry_time(candidate) >= feedback_entry_time(existing):
            latest_by_user_image[key] = candidate

    return list(latest_by_user_image.values())


def find_feedback_consensus(image_hash: str, perceptual_hash: str) -> Optional[Dict[str, Any]]:
    candidates = []
    for entry in load_feedback_entries():
        if not isinstance(entry, dict) or not entry.get("corrected_label"):
            continue

        candidate = build_feedback_candidate(
            entry,
            image_hash=image_hash,
            perceptual_hash=perceptual_hash,
        )
        if candidate and candidate.get("weight", 0) > 0:
            candidates.append(candidate)

    deduped_candidates = dedupe_feedback_candidates(candidates)
    if not deduped_candidates:
        return None

    support_by_label: Dict[str, float] = {}
    entries_by_label: Dict[str, List[Dict[str, Any]]] = {}
    total_support = 0.0
    for candidate in deduped_candidates:
        label = str(candidate["corrected_label"])
        weight = float(candidate["weight"])
        support_by_label[label] = support_by_label.get(label, 0.0) + weight
        entries_by_label.setdefault(label, []).append(candidate)
        total_support += weight

    if total_support <= 0:
        return None

    corrected_label, label_support = max(
        support_by_label.items(),
        key=lambda item: (item[1], item[0]),
    )
    label_entries = entries_by_label[corrected_label]
    has_exact = any(entry["match_type"] == "exact" for entry in label_entries)
    match_type = "exact" if has_exact else "near"
    consensus = label_support / total_support
    min_distance = min(int(entry["distance"]) for entry in label_entries)
    baked_entries = [
        entry
        for entry in label_entries
        if entry["match_type"] == "exact" and (
            entry.get("low_confidence_baked_feedback")
            or entry.get("low_confidence_class_switch")
            or entry.get("low_confidence_correct_feedback")
        )
    ]
    low_confidence_class_switch = any(bool(entry.get("low_confidence_class_switch")) for entry in baked_entries)
    low_confidence_correct_feedback = any(
        bool(entry.get("low_confidence_correct_feedback")) for entry in baked_entries
    )
    baked_confidence = None
    if baked_entries:
        baked_confidence = baked_entries[0].get("baked_confidence")
        if baked_confidence is None:
            baked_confidence = deterministic_baked_confidence(image_hash, corrected_label)

    applies = (
        consensus >= config.FEEDBACK_EXACT_CONSENSUS_THRESHOLD
        if has_exact
        else (
            label_support >= config.FEEDBACK_NEAR_SUPPORT_THRESHOLD
            and consensus >= config.FEEDBACK_NEAR_CONSENSUS_THRESHOLD
        )
    )

    return {
        "applies": applies,
        "match_type": match_type,
        "corrected_label": corrected_label,
        "support_weight": round(label_support, 4),
        "total_support_weight": round(total_support, 4),
        "consensus": round(consensus, 4),
        "distance": min_distance,
        "source_image_hash": label_entries[0].get("image_hash"),
        "low_confidence_class_switch": low_confidence_class_switch,
        "low_confidence_correct_feedback": low_confidence_correct_feedback,
        "low_confidence_baked_feedback": bool(baked_entries),
        "baked_confidence": baked_confidence,
        "feedback_ids": [
            str(entry.get("feedback_id") or entry.get("id"))
            for entry in label_entries
            if entry.get("feedback_id") or entry.get("id")
        ],
        "is_correct": all(bool(entry.get("is_correct")) for entry in label_entries),
    }


def build_feedback_adjusted_metadata(
    consensus: Optional[Dict[str, Any]],
    summary: Dict[str, Any],
) -> Dict[str, Any]:
    metadata = {
        "applied": False,
        "raw_prediction": summary["prediction"],
        "raw_model_prediction": summary["model_prediction"],
        "raw_confidence": summary["confidence"],
        "raw_decision": summary["decision"],
    }
    if not consensus:
        return metadata

    corrected_label = consensus["corrected_label"]
    match_type = consensus["match_type"]
    class_probability_key = feedback_label_to_probability_key(corrected_label, summary)
    base_class_probability = float(summary.get("all_probabilities", {}).get(class_probability_key, 0.0))

    if not consensus["applies"]:
        metadata.update(
            {
                "match_type": match_type,
                "corrected_label": corrected_label,
                "base_class_probability": round(base_class_probability, 4),
                "support_weight": consensus["support_weight"],
                "total_support_weight": consensus["total_support_weight"],
                "consensus": consensus["consensus"],
                "distance": consensus["distance"],
                "source_image_hash": consensus["source_image_hash"],
                "low_confidence_class_switch": consensus["low_confidence_class_switch"],
                "low_confidence_correct_feedback": consensus["low_confidence_correct_feedback"],
                "low_confidence_baked_feedback": consensus["low_confidence_baked_feedback"],
                "baked_confidence": consensus["baked_confidence"],
                "feedback_ids": consensus["feedback_ids"],
            }
        )
        return metadata

    confidence_strategy = "dynamic_consensus"
    baked_confidence = consensus.get("baked_confidence")
    if consensus.get("low_confidence_baked_feedback") and baked_confidence is not None:
        adjusted_confidence = float(baked_confidence)
        confidence_strategy = (
            "baked_low_confidence_class_switch"
            if consensus.get("low_confidence_class_switch")
            else "baked_low_confidence_correct_feedback"
        )
    else:
        trusted_support = min(float(consensus["support_weight"]), config.FEEDBACK_MAX_TRUSTED_SUPPORT)
        max_boost = config.FEEDBACK_MAX_BOOST_PER_SUPPORT * trusted_support
        adjusted_confidence = min(
            config.FEEDBACK_MAX_CONFIDENCE,
            base_class_probability + (max_boost * float(consensus["consensus"])),
        )
    adjusted_prediction = feedback_label_to_display_prediction(corrected_label)
    adjusted_decision = feedback_label_decision(corrected_label, match_type)

    metadata.update(
        {
            "applied": True,
            "match_type": match_type,
            "corrected_label": corrected_label,
            "adjusted_prediction": adjusted_prediction,
            "adjusted_confidence": round(adjusted_confidence, 4),
            "adjusted_decision": adjusted_decision,
            "confidence_strategy": confidence_strategy,
            "base_class_probability": round(base_class_probability, 4),
            "support_weight": consensus["support_weight"],
            "total_support_weight": consensus["total_support_weight"],
            "consensus": consensus["consensus"],
            "is_correct": bool(consensus["is_correct"]),
            "source_image_hash": consensus["source_image_hash"],
            "distance": consensus["distance"],
            "low_confidence_class_switch": consensus["low_confidence_class_switch"],
            "low_confidence_correct_feedback": consensus["low_confidence_correct_feedback"],
            "low_confidence_baked_feedback": consensus["low_confidence_baked_feedback"],
            "baked_confidence": round(float(baked_confidence), 4) if baked_confidence is not None else None,
            "feedback_ids": consensus["feedback_ids"],
            "feedback_id": consensus["feedback_ids"][0] if consensus["feedback_ids"] else None,
        }
    )
    return metadata


def apply_feedback_to_prediction_summary(
    summary: Dict[str, Any],
    feedback_metadata: Dict[str, Any],
) -> Dict[str, Any]:
    """Return the user-facing prediction with feedback correction applied."""
    if not feedback_metadata.get("applied"):
        return summary

    prediction = feedback_metadata["adjusted_prediction"]
    decision = feedback_metadata["adjusted_decision"]
    accepted = decision != "rejected"
    all_probabilities = dict(summary.get("all_probabilities", {}))
    adjusted_probability_key = feedback_label_to_probability_key(
        feedback_metadata["corrected_label"],
        summary,
    )
    if adjusted_probability_key in all_probabilities:
        all_probabilities[adjusted_probability_key] = feedback_metadata["adjusted_confidence"]
    top_predictions = [
        {
            "class_name": class_name,
            "probability": probability,
        }
        for class_name, probability in sorted(
            all_probabilities.items(),
            key=lambda item: item[1],
            reverse=True,
        )[:3]
    ]
    response_summary = {
        **summary,
        "accepted": accepted,
        "decision": decision,
        "prediction": prediction,
        "confidence": feedback_metadata["adjusted_confidence"],
        "all_probabilities": all_probabilities,
        "top_predictions": top_predictions,
        "guidance": DISEASE_GUIDANCE.get(prediction) if accepted else UNKNOWN_GUIDANCE,
    }

    if decision == "rejected":
        response_summary["rejection_reasons"] = ["feedback_corrected_unknown"]

    return response_summary


def build_prediction_summary(predictions: np.ndarray) -> Dict[str, Any]:
    """Convert raw probabilities into a response with unknown-only rejection."""
    probabilities = predictions[0].astype(np.float64)
    sorted_indices = np.argsort(probabilities)[::-1]

    predicted_idx = int(sorted_indices[0])
    second_idx = int(sorted_indices[1]) if len(sorted_indices) > 1 else predicted_idx

    confidence = float(probabilities[predicted_idx])
    second_confidence = float(probabilities[second_idx])
    margin = confidence - second_confidence

    entropy = float(
        -np.sum(probabilities * np.log(np.clip(probabilities, 1e-10, 1.0)))
    )
    max_entropy = float(np.log(len(probabilities))) if len(probabilities) > 1 else 1.0
    normalized_entropy = entropy / max_entropy if max_entropy else 0.0

    strong_match = (
        confidence >= config.CONFIDENCE_THRESHOLD
        and margin >= config.MARGIN_THRESHOLD
        and normalized_entropy <= config.ENTROPY_THRESHOLD
    )

    model_prediction = state.class_names[predicted_idx]
    predicted_unknown = model_prediction == config.UNKNOWN_CLASS_NAME
    decision = "rejected"
    if predicted_unknown:
        decision = "rejected"
    elif strong_match:
        decision = "accepted"
    else:
        decision = "likely"

    accepted = decision != "rejected"

    rejection_reasons = []
    if decision == "rejected":
        if predicted_unknown:
            rejection_reasons.append("predicted_unknown_class")

    final_prediction = model_prediction if accepted else config.UNKNOWN_LABEL

    all_probabilities = {
        state.class_names[i]: round(float(probabilities[i]), 4)
        for i in range(len(state.class_names))
    }

    top_predictions = [
        {
            "class_name": state.class_names[int(idx)],
            "probability": round(float(probabilities[int(idx)]), 4),
        }
        for idx in sorted_indices[: min(3, len(sorted_indices))]
    ]

    return {
        "accepted": accepted,
        "decision": decision,
        "prediction": final_prediction,
        "model_prediction": model_prediction,
        "confidence": round(confidence, 4),
        "margin": round(float(margin), 4),
        "normalized_entropy": round(float(normalized_entropy), 4),
        "rejection_reasons": rejection_reasons,
        "all_probabilities": all_probabilities,
        "top_predictions": top_predictions,
        "guidance": DISEASE_GUIDANCE.get(model_prediction) if accepted else UNKNOWN_GUIDANCE,
    }

@app.post("/debug-predict", tags=["Debug"])
async def debug_predict(file: UploadFile = File(...)):
    """Debug endpoint - shows raw model outputs"""
    if state.model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    try:
        image_bytes = await file.read()
        processed_image = preprocess_image(image_bytes)
        
        # Get predictions
        predictions = state.model.predict(processed_image, verbose=0)
        summary = build_prediction_summary(predictions)
        
        return {
            "raw_predictions": predictions[0].tolist(),
            **summary,
            "image_shape": processed_image.shape,
            "pixel_range": {
                "min": float(processed_image.min()),
                "max": float(processed_image.max()),
                "mean": float(processed_image.mean())
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.get("/", tags=["Health"])
async def root() -> Dict[str, Any]:
    """API root - basic health check"""
    return {
        "service": "Maize Disease Detection API",
        "status": "online",
        "version": "2.0.0",
        "model_loaded": state.model is not None
    }


@app.get("/health", tags=["Health"])
async def health_check() -> Dict[str, Any]:
    """Detailed health check endpoint"""
    if state.model is None:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded"
        )
    
    return {
        "status": "healthy",
        "model": {
            "loaded": True,
            "input_size": config.IMG_SIZE,
            "classes": len(state.class_names)
        },
        "tensorflow_version": tf.__version__,
        "keras_version": keras.__version__
    }


@app.get("/classes", tags=["Info"])
async def get_classes() -> Dict[str, Any]:
    """Get list of detectable disease classes"""
    if state.class_names is None:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded"
        )
    
    return {
        "classes": state.class_names,
        "count": len(state.class_names)
    }


def parse_feedback_payload(payload: str) -> FeedbackRequest:
    try:
        data = json.loads(payload)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="payload must be valid JSON") from exc

    try:
        return FeedbackRequest(**data)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="payload does not match feedback schema") from exc


async def read_optional_feedback_image(
    file: Optional[UploadFile],
    *,
    expected_image_hash: str,
    training_consent: bool,
) -> Optional[bytes]:
    if not training_consent:
        return None

    if file is None:
        raise HTTPException(
            status_code=400,
            detail="file is required when training_consent is true",
        )

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type: {file.content_type}. Expected image.",
        )

    image_bytes = await file.read()
    validate_image_size(len(image_bytes))
    actual_hash = compute_image_sha256(image_bytes)
    if actual_hash != expected_image_hash:
        raise HTTPException(
            status_code=400,
            detail="feedback image does not match the prediction image_hash",
        )

    # Reuse preprocessing validation so corrupt files are not saved for retraining.
    preprocess_image(image_bytes)
    return image_bytes


@app.post("/feedback", tags=["Feedback"])
async def submit_feedback(
    payload: str = Form(...),
    file: Optional[UploadFile] = File(None),
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    """Persist user feedback for exact or near-duplicate future predictions."""
    feedback = parse_feedback_payload(payload)
    request_prediction_id = feedback.prediction_id.strip() if feedback.prediction_id else None
    request_image_hash = feedback.image_hash.strip() if feedback.image_hash else None

    if not request_prediction_id and not request_image_hash:
        raise HTTPException(
            status_code=400,
            detail="prediction_id or image_hash is required",
        )

    corrected_label = validate_feedback_label(feedback.corrected_label)
    feedback.corrected_label = corrected_label
    requested_hash = validate_image_hash_value(request_image_hash) if request_image_hash else None
    derived_hash = image_hash_from_prediction_id(request_prediction_id)
    if requested_hash and derived_hash and requested_hash != derived_hash:
        raise HTTPException(
            status_code=400,
            detail="image_hash does not match prediction_id",
        )

    prediction_record = select_feedback_prediction_record(
        prediction_id=request_prediction_id,
        image_hash=requested_hash or derived_hash,
    )

    if not prediction_record:
        raise HTTPException(
            status_code=404,
            detail="No stored prediction was found for prediction_id",
        )

    record_hash = validate_image_hash_value(prediction_record["image_hash"])
    if requested_hash and requested_hash != record_hash:
        raise HTTPException(
            status_code=400,
            detail="image_hash does not match prediction_id",
        )
    if derived_hash and derived_hash != record_hash:
        raise HTTPException(
            status_code=400,
            detail="image_hash does not match prediction_id",
        )

    user_id = resolve_authenticated_user_id(authorization, required=True)
    image_bytes = await read_optional_feedback_image(
        file,
        expected_image_hash=record_hash,
        training_consent=feedback.training_consent,
    )
    image_object_path = None
    if image_bytes is not None:
        image_object_path = upload_feedback_image_to_supabase(
            user_id=user_id,
            image_hash=record_hash,
            file_bytes=image_bytes,
            filename=file.filename,
            content_type=file.content_type,
        )

    entry = upsert_feedback_entry(
        prediction_record=prediction_record,
        feedback=feedback,
        user_id=user_id,
        image_object_path=image_object_path,
    )

    return {
        "success": True,
        "feedback": entry,
    }


@app.post("/predict", tags=["Prediction"])
async def predict(
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    """
    Predict disease from corn leaf image
    
    Accepts: JPG, PNG, JPEG images
    Returns: Prediction with confidence scores
    """
    # Validate model availability
    if state.model is None:
        raise HTTPException(
            status_code=503,
            detail="Model not available"
        )
    
    # Validate content type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type: {file.content_type}. Expected image."
        )
    
    try:
        # Read image
        image_bytes = await file.read()
        validate_image_size(len(image_bytes))
        image_hash = compute_image_sha256(image_bytes)
        perceptual_hash = compute_perceptual_hash(image_bytes)
        prediction_id = build_prediction_id(image_hash)
        
        # Preprocess
        processed_image = preprocess_image(image_bytes)
        
        # Inference (synchronous - best practice for CPU inference)
        logger.info(f"Processing: {file.filename}")
        predictions = state.model.predict(processed_image, verbose=0)
        summary = build_prediction_summary(predictions)
        feedback_consensus = find_feedback_consensus(image_hash, perceptual_hash)
        feedback_adjusted = build_feedback_adjusted_metadata(feedback_consensus, summary)
        response_summary = apply_feedback_to_prediction_summary(summary, feedback_adjusted)
        user_id = resolve_authenticated_user_id(authorization, required=False)
        record_prediction_for_feedback(
            prediction_id=prediction_id,
            image_hash=image_hash,
            perceptual_hash=perceptual_hash,
            filename=file.filename,
            content_type=file.content_type,
            user_id=user_id,
            summary=response_summary,
            feedback_adjusted=feedback_adjusted,
        )

        logger.info(
            "Result: %s | model=%s | confidence=%.2f%% | decision=%s",
            response_summary["prediction"],
            response_summary["model_prediction"],
            response_summary["confidence"] * 100,
            response_summary["decision"],
        )
        
        return {
            "success": True,
            **response_summary,
            "filename": file.filename,
            "prediction_id": prediction_id,
            "image_hash": image_hash,
            "feedback_adjusted": feedback_adjusted,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Prediction error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Prediction failed. Please try again."
        )


# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run(
#         "main:app",
#         host="0.0.0.0",
#         port=8000,
#         reload=True,
#         log_level="info"
#     )
