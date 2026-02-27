# Deployment Runbook

## Recommended: Railway (quickest/easiest)

Railway is usually the fastest path for a FastAPI + TensorFlow service from this repo.

### Backend (Railway)
1. Push this repo to GitHub.
2. In Railway: `New Project` -> `Deploy from GitHub Repo`.
3. Select this repo and set **Root Directory** to `src/api`.
4. Railway will detect Python and install from `requirements.txt`.
5. Ensure start command is from `Procfile`:
   - `web: uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}`
6. Add environment variable:
   - `CORS_ORIGINS=https://your-frontend.vercel.app`
7. Deploy and copy the generated Railway backend URL.

### Frontend (Vercel)
1. In Vercel project settings, set:
   - `VITE_API_URL=https://your-railway-backend.up.railway.app`
2. Redeploy frontend.

## Notes
- `src/api/venv/` is excluded from Vercel uploads via `.vercelignore`.
- API CORS now supports comma-separated origins via `CORS_ORIGINS`.
- Model path is now deployment-safe and defaults to `src/api/best_model.keras`.
