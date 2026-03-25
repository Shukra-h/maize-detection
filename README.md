# Maize Detection

Maize Detection is a beginner-friendly web app that helps identify common maize leaf diseases from an image.

Live app: https://maize-detection.vercel.app/

## What this project does

Upload a photo of a maize leaf and the app will predict one of these classes:

- Gray Leaf Spot
- Common Rust
- Northern Leaf Blight
- Healthy Leaf

The project has two parts:

- `src/frontend` - the website users interact with
- `src/api` - the FastAPI backend that loads the trained model and returns predictions

## Tech stack

- Frontend: React + TypeScript + Vite + Chakra UI
- Backend: FastAPI + TensorFlow + Keras
- Model file: `src/api/best_model.keras`

## Before you start

Install these first:

- Git
- Python 3.10 or newer
- Node.js 18 or newer

You can check your versions with:

```bash
python --version
node --version
git --version
```

If `python` does not work on your machine, try `python3`.

## Quick start

If you only want to try the project, use the live site:

https://maize-detection.vercel.app/

If you want to run it on your computer, follow the local setup steps below.

## 1. Clone the project

Open your terminal and run:

```bash
git clone https://github.com/Shukra-h/maize-detection.git
cd maize-detection
```

## 2. Start the backend

The backend runs the AI model and serves the API.

### macOS

1. Go to the API folder:

```bash
cd src/api
```

2. Create a virtual environment:

```bash
python3 -m venv .venv
```

3. Activate it:

```bash
source .venv/bin/activate
```

4. Install Python packages:

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

5. Start the backend server:

```bash
uvicorn main:app --reload
```

The backend should now be running at:

- `http://127.0.0.1:8000`
- API docs: `http://127.0.0.1:8000/docs`

### Windows

1. Go to the API folder:

```powershell
cd src/api
```

2. Create a virtual environment:

```powershell
python -m venv .venv
```

3. Activate it:

```powershell
.venv\Scripts\activate
```

4. Install Python packages:

```powershell
pip install --upgrade pip
pip install -r requirements.txt
```

5. Start the backend server:

```powershell
uvicorn main:app --reload
```

The backend should now be running at:

- `http://127.0.0.1:8000`
- API docs: `http://127.0.0.1:8000/docs`

## 3. Start the frontend

Open a new terminal window or tab. Keep the backend running in the first terminal.

### macOS

From the project root:

```bash
cd src/frontend
npm install
npm run dev
```

### Windows

From the project root:

```powershell
cd src/frontend
npm install
npm run dev
```

The frontend should open in your browser automatically. If it does not, open the URL shown in the terminal. Vite usually starts on:

- `http://localhost:5173`

## 4. Use the app

1. Open the frontend in your browser.
2. Upload a maize leaf image.
3. Wait for the prediction result.
4. Review the confidence score and disease guidance.

## How the frontend connects to the backend

By default, the frontend talks to:

```text
http://localhost:8000
```

If you want to point the frontend to another backend URL, create a file named `.env` inside `src/frontend` and add:

```env
VITE_API_URL=http://127.0.0.1:8000
```

Then restart the frontend.

## Project structure

```text
maize-detection/
├── README.md
├── DEPLOYMENT.md
├── src/
│   ├── api/
│   │   ├── main.py
│   │   ├── requirements.txt
│   │   └── best_model.keras
│   └── frontend/
│       ├── package.json
│       ├── main.tsx
│       └── components/
```

## Useful commands

### Backend

```bash
cd src/api
uvicorn main:app --reload
```

### Frontend

```bash
cd src/frontend
npm run dev
```

### Build the frontend for production

```bash
cd src/frontend
npm run build
```

## Troubleshooting

### `python` is not recognized

Try:

```bash
python3 --version
```

On Windows, you may need to install Python first and make sure it is added to PATH.

### `uvicorn` is not recognized

Your virtual environment may not be activated. Activate `.venv` first, then run:

```bash
uvicorn main:app --reload
```

### The frontend loads but predictions do not work

Check these:

- The backend is running on `http://127.0.0.1:8000`
- You started the frontend from `src/frontend`
- `VITE_API_URL` is correct if you changed it

### TensorFlow install issues

TensorFlow can take longer to install than other packages. If installation fails:

- Confirm your Python version is compatible
- Upgrade `pip`
- Try the install again inside the virtual environment

## API endpoints

- `GET /docs` - interactive API documentation
- `GET /health` - health check
- `GET /classes` - list of prediction classes
- `POST /predict` - upload an image and get a prediction

## Notes

- The model file is already included at `src/api/best_model.keras`
- The local frontend defaults to the local backend
- The live frontend is available at https://maize-detection.vercel.app/
