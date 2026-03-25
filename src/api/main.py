
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from contextlib import asynccontextmanager
from PIL import Image
import numpy as np
import tensorflow as tf
from tensorflow import keras
from io import BytesIO
import logging
from typing import Dict, Any, List, Optional
import os
from pathlib import Path

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

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


DEFAULT_CLASS_NAMES = [
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot",
    "Corn_(maize)___Common_rust_",
    "Corn_(maize)___Northern_Leaf_Blight",
    "Corn_(maize)___healthy",
]

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


class Config:
    MODEL_PATH = os.getenv(
        "MODEL_PATH",
        str(Path(__file__).resolve().parent / "best_model.keras")
    )  # Use .keras format (Keras 3 native)
    IMG_SIZE = (224, 224)
    MAX_IMAGE_SIZE_MB = 10
    CORS_ORIGINS = parse_cors_origins(os.getenv("CORS_ORIGINS", "*"))
    CLASS_NAMES = parse_class_names(os.getenv("CLASS_NAMES")) or DEFAULT_CLASS_NAMES
    
config = Config()
logger.info(f"CORS origins configured: {config.CORS_ORIGINS}")

# Global state
class ModelState:
    model: keras.Model = None
    class_names: list = None

state = ModelState()


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
        state.model = keras.models.load_model(config.MODEL_PATH, compile=False)
        
        # This order must exactly match the class index order used during training.
        state.class_names = config.CLASS_NAMES
        
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
        # Open and convert to RGB
        image = Image.open(BytesIO(image_bytes)).convert("RGB")
        
        # Resize to model input size
        image = image.resize(config.IMG_SIZE)
        
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
        
        # Get all probabilities
        all_probs = {
            state.class_names[i]: float(predictions[0][i])
            for i in range(len(state.class_names))
        }
        
        return {
            "raw_predictions": predictions[0].tolist(),
            "predicted_class": state.class_names[int(np.argmax(predictions[0]))],
            "confidence": float(np.max(predictions[0])),
            "all_probabilities": all_probs,
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
        
        # Extract results
        predicted_idx = int(np.argmax(predictions[0]))
        confidence = float(np.max(predictions[0]))
        predicted_class = state.class_names[predicted_idx]
        
        # Get all class probabilities
        all_probabilities = {
            state.class_names[i]: round(float(predictions[0][i]), 4)
            for i in range(len(state.class_names))
        }
        
        logger.info(f"Result: {predicted_class} ({confidence:.2%})")
        
        return {
            "success": True,
            "prediction": predicted_class,
            "confidence": round(confidence, 4),
            "all_probabilities": all_probabilities,
            "guidance": DISEASE_GUIDANCE.get(predicted_class),
            "filename": file.filename
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
