from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import numpy as np
import tensorflow as tf
from io import BytesIO
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input

app = FastAPI(title="Maize Disease Detection API")

# Allow frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # restrict later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load model ONCE at startup
model = tf.keras.models.load_model(
    "maize_model.h5",
    custom_objects={"TrueDivide": tf.keras.layers.Lambda(lambda x: x / 255.0)}
)

CLASS_NAMES = [
    "Corn___Common_rust",
    "Corn___Gray_leaf_spot",
    "Corn___Healthy",
    "Corn___Northern_Leaf_Blight"
]

IMG_SIZE = (224, 224)


def read_image(file_bytes: bytes) -> np.ndarray:
    image = Image.open(BytesIO(file_bytes)).convert("RGB")
    image = image.resize(IMG_SIZE)
    image = np.array(image).astype("float32")
    image = preprocess_input(image)
    image = np.expand_dims(image, axis=0)
    return image


@app.get("/")
def root():
    return {"status": "Maize Disease API running"}


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    image = read_image(await file.read())
    preds = model.predict(image)
    idx = int(np.argmax(preds))
    confidence = float(np.max(preds))

    return {
        "prediction": CLASS_NAMES[idx],
        "confidence": round(confidence, 4)
    }
