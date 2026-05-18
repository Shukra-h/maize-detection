# Deployment Runbook

## Recommended: Railway (quickest/easiest)

Railway is usually the fastest path for a FastAPI + TensorFlow service from this repo.

### Backend (Railway)
1. Push this repo to GitHub.
2. In Railway: `New Project` -> `Deploy from GitHub Repo`.
3. Select this repo and set **Root Directory** to `src/api`.
4. Use the Dockerfile deployment path for deterministic builds:
   - Railway should auto-detect `src/api/Dockerfile`.
   - This avoids Railpack/Nixpacks Python-version mismatch issues.
5. Ensure start command is from `Procfile`:
   - `web: uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}`
6. Add environment variable:
   - `CORS_ORIGINS=https://your-frontend.vercel.app`
7. Deploy and copy the generated Railway backend URL.

### Frontend (Vercel)
1. In Vercel project settings, set:
   - `VITE_API_URL=https://your-railway-backend.up.railway.app`
   - `VITE_SUPABASE_URL=your-supabase-project-url`
   - `VITE_SUPABASE_ANON_KEY=your-supabase-anon-key`
2. Redeploy frontend.

The frontend uses React Router for `/detection`. The existing `vercel.json` rewrites all non-file routes to `index.html`, so direct visits to `/detection` should keep working after deployment.

## Notes
- `src/api/venv/` is excluded from Vercel uploads via `.vercelignore`.
- API CORS now supports comma-separated origins via `CORS_ORIGINS`.
- Backend ships with both `src/api/best_model.keras` and `src/api/class_names.json`.
- Model path is deployment-safe and defaults to the local API directory copy of `best_model.keras`.
- If Railway build fails with `No matching distribution found for tensorflow==...`, it means the Python runtime and TensorFlow wheel version do not match.
  - Current backend is pinned to `tensorflow==2.18.0`.
  - Runtime hint is included via `src/api/runtime.txt`.
  - Preferred fix: deploy from `src/api/Dockerfile` to lock Python to 3.10.
