
AI-powered web application for detecting corn leaf diseases using deep learning. Achieves 97.2% accuracy on validation data.

## 📋 Features

- **Real-time Disease Detection** - Upload corn leaf images and get instant predictions
- **4 Disease Classes Supported**:
  - Cercospora Leaf Spot (Gray Leaf Spot)
  - Common Rust
  - Northern Leaf Blight
  - Healthy
- **High Accuracy** - 97.2% validation accuracy
- **Modern UI** - Built with React and Chakra UI
- **Fast API Backend** - Production-ready FastAPI server

## 🏗️ Project Structure

```
maize-detection/
├── backend/
│   ├── main.py              # FastAPI application
│   ├── best_model.keras     # Trained ML model
│   ├── requirements.txt     # Python dependencies
│   └── venv/               # Virtual environment
├── frontend/
│   ├── src/
│   │   └── Demo.tsx        # Main UI component
│   ├── package.json
│   └── ...
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- **Python 3.9+**
- **Node.js 16+** and npm/yarn
- **Git**

### Backend Setup

1. **Clone the repository**
   ```in terminal
   git clone https://github.com/Shukra-h/maize-detection.git
   cd maize-detection/backend
   ```

2. **Create virtual environment**
   ```in terminal
   python3.9 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```in terminal
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

4. **Download the trained model**
   - Download `best_model.keras` from [Google Drive/releases]
   - Place it in the `backend/` folder

5. **Run the backend server**
   ```in terminal
   uvicorn main:app --reload
   ```
   
   Server will start at `http://localhost:8000`
   - API docs: `http://localhost:8000/docs`
   - Health check: `http://localhost:8000/health`

### Frontend Setup

1. **Navigate to frontend directory**
   ```in terminal
   cd ../frontend
   ```

2. **Install dependencies**
   ```in terminal
   npm install
   # or
   yarn install
   ```

3. **Start development server**
   ```in terminal
   npm run dev
   # or
   yarn dev
   ```
   
   Frontend will start at `http://localhost:3000` (or `http://localhost:5173` for Vite)

## 📝 Usage

1. Open the frontend in your browser
2. Click "Choose File" and upload a corn leaf image
3. Click "Analyze Image"
4. View the prediction results with confidence scores

### Supported Image Formats
- JPG/JPEG
- PNG
- Max size: 10MB

### Best Results
For optimal accuracy, upload images similar to the training data:
- Close-up shots of individual corn leaves
- Good lighting conditions
- Clear focus on disease symptoms
- Minimal background

## 🔧 Configuration

### Backend Configuration

Edit `main.py` to customize:

```python
class Config:
    MODEL_PATH = "best_model.keras"
    IMG_SIZE = (224, 224)
    MAX_IMAGE_SIZE_MB = 10
    CORS_ORIGINS = ["*"]  # Update for production
```

### Frontend Configuration

Edit the API URL in `Demo.tsx`:

```typescript
const API_URL = "http://localhost:8000";  // Change for production
```

## 📊 API Endpoints

### `POST /predict`
Predict disease from uploaded image

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body: `file` (image file)

**Response:**
```json
{
  "success": true,
  "prediction": "Corn_(maize)___Common_rust_",
  "confidence": 0.9896,
  "all_probabilities": {
    "Corn_(maize)___Common_rust_": 0.9896,
    "Corn_(maize)___healthy": 0.0010,
    ...
  },
  "filename": "leaf.jpg"
}
```

### `GET /health`
Check API health status

### `GET /classes`
Get list of supported disease classes

### `POST /debug-predict`
Debug endpoint with detailed prediction info

## 🧪 Model Information

- **Architecture**: MobileNetV2-based transfer learning
- **Input Size**: 224x224 RGB images
- **Training Data**: ~7,300 images across 4 classes
- **Validation Accuracy**: 97.2%
- **Framework**: TensorFlow/Keras 3.x

### Model Training

The model was trained with:
- **Batch Size**: 32
- **Epochs**: 10-20 (with early stopping)
- **Data Augmentation**: Random flip, rotation, zoom
- **Optimizer**: Adam (lr=0.001)
- **Loss**: Categorical crossentropy


**Frontend:**
```in terminal
npm run build
# or
yarn build
```

## 🐛 Troubleshooting

### Model Loading Errors

**Error**: `Model not loaded` or `quantization_config` errors

**Solution**: Ensure you're using a compatible TensorFlow/Keras version:
```bash
pip install tensorflow==2.18.0
```

### CORS Issues

**Error**: `CORS policy blocked`

**Solution**: Update `CORS_ORIGINS` in `main.py` to include your frontend URL:
```python
CORS_ORIGINS = ["http://localhost:3000", "http://localhost:5173"]
```

### Low Accuracy on Custom Images

The model performs best on images similar to the training dataset. For images from different sources:
- Ensure good lighting and focus
- Use close-up shots of leaves
- Consider retraining with more diverse data

## 📦 Dependencies

### Backend
- FastAPI 0.115.0
- TensorFlow 2.18.0
- Pillow 11.0.0
- Uvicorn 0.32.0
- Python-multipart 0.0.12

### Frontend
- React 18+
- Chakra UI
- TypeScript
- Vite (or Create React App)

## 📄 License

[Your License Here]



**Note**: This model is trained on a specific dataset and works best with similar images. For production use with diverse image sources, consider retraining with additional data augmentation or a more diverse dataset.
