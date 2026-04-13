
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from contextlib import asynccontextmanager, contextmanager
from PIL import Image, ImageOps
import json
import numpy as np
import tensorflow as tf
from tensorflow import keras
from io import BytesIO
import logging
from typing import Dict, Any, List, Optional
import os
from pathlib import Path
import re

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
    
config = Config()
logger.info(f"CORS origins configured: {config.CORS_ORIGINS}")

# Global state
class ModelState:
    model: keras.Model = None
    class_names: list = None

state = ModelState()


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


@app.post("/predict", tags=["Prediction"])
async def predict(file: UploadFile = File(...)) -> Dict[str, Any]:
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
        
        # Preprocess
        processed_image = preprocess_image(image_bytes)
        
        # Inference (synchronous - best practice for CPU inference)
        logger.info(f"Processing: {file.filename}")
        predictions = state.model.predict(processed_image, verbose=0)
        summary = build_prediction_summary(predictions)

        logger.info(
            "Result: %s | model=%s | confidence=%.2f%% | decision=%s",
            summary["prediction"],
            summary["model_prediction"],
            summary["confidence"] * 100,
            summary["decision"],
        )
        
        return {
            "success": True,
            **summary,
            "filename": file.filename,
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
