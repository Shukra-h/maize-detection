# Testing Guide

This guide explains the tests in this project in simple terms: what tools are used, what the tests check, how to run them, and what to do when something fails.

## Why Tests Matter

The app has two important parts:

- The backend API in `src/api` loads the maize disease model and decides what prediction response to return.
- The frontend in `src/frontend` lets a user upload an image, sends it to the backend, and shows the result.

Tests help confirm that these parts still work after code changes. They do not prove the model is perfectly accurate, but they do catch broken API behavior, broken frontend flows, invalid image handling, and mistakes in prediction decision logic.

## Testing Technology Used

### Backend

The backend uses `pytest`.

`pytest` is a Python test runner. It finds files named like `test_*.py`, runs the test functions inside them, and reports whether they pass or fail.

The backend also uses FastAPI's test client through `httpx`. This lets the tests call API routes like `/health`, `/classes`, and `/predict` without starting a real server manually.

### Frontend

The frontend uses `Vitest`.

`Vitest` is a JavaScript and TypeScript test runner that works well with Vite projects.

The frontend also uses React Testing Library. This lets the tests render React components the way a user would see them, then click buttons, upload files, and check what appears on the screen.

The frontend tests run in `jsdom`. `jsdom` is a fake browser environment for tests. It lets React components run without opening Chrome or Safari.

The frontend history feature uses IndexedDB in the browser, so the tests use `fake-indexeddb`. This gives the tests a fake IndexedDB database.

## Backend Tests

Backend tests live here:

```text
src/api/tests/
```

### What They Test

`test_api_contract.py` checks the main API routes.

It confirms that:

- `/` returns the service status.
- `/health` returns healthy when a model is loaded.
- `/health` returns an error when no model is loaded.
- `/classes` returns the runtime class order.
- `/predict` rejects non-image uploads.
- `/predict` rejects broken image bytes.
- `/predict` rejects images that are too large.

`test_prediction_decisions.py` checks the prediction decision rules.

It confirms that:

- A strong maize disease prediction is accepted.
- A weaker maize prediction is still shown as likely instead of being rejected.
- An image is rejected only when `unknown_unclassified` is the top model output.
- The API response includes top predictions and the probability map.

`test_preprocessing.py` checks image preparation before model inference.

It confirms that:

- Images are converted to the model input shape `(1, 224, 224, 3)`.
- Images become `float32` arrays.
- Invalid image bytes raise a proper HTTP 400 error.

`test_real_model_smoke.py` is a slower smoke test.

It confirms that:

- `src/api/best_model.keras` exists.
- `src/api/class_names.json` exists.
- The shipped model can load.
- The model can return a probability for each class.
- The probabilities add up like a normal softmax output.

### Why Most Backend Tests Use a Fake Model

Most backend tests do not load the real Keras model.

Instead, they install a fake model that returns controlled probabilities, such as:

```text
healthy = 0.90
unknown_unclassified = 0.02
```

This makes the tests fast and reliable. It also lets us test exact decision rules, such as whether an unknown image should be rejected.

The real model is still tested separately by the slow smoke test.

## Frontend Tests

Frontend tests currently live here:

```text
src/frontend/components/
```

Test setup lives here:

```text
src/frontend/test/setup.ts
```

### What They Test

`detectionHistory.test.ts` checks local detection history.

It confirms that:

- History starts empty.
- Saved detections are returned newest first.
- A saved detection can be deleted.
- Old detections can be pruned when the history limit is reached.

`i18n.test.ts` checks class labels and guidance translation.

It confirms that:

- Backend class names are converted into friendly labels.
- `unknown_unclassified` becomes a user-facing rejection label.
- Disease guidance can be shown in supported languages.
- Missing guidance falls back safely.

`Test.integration.test.tsx` checks the detector UI flow.

It confirms that:

- Uploading a non-image file shows validation feedback.
- Uploading an image sends a request to the backend.
- A successful prediction appears on the screen.
- The result is saved to detection history.
- A rejected unknown prediction is displayed correctly.
- A previous detection can be restored from history.

`App.routing.test.tsx` checks the frontend route guard.

It confirms that:

- The landing page button routes users to `/detection`.
- `/detection` is blocked when there is no signed-in Supabase session.
- `/detection` opens the detector when a session exists.

### Why Frontend Tests Mock the API

The frontend tests do not call the real backend.

They mock `fetch` and return a fake backend response. This keeps frontend tests focused on frontend behavior:

- Did the upload button work?
- Did the UI show the prediction?
- Did the confidence value display correctly?
- Did history save correctly?

Backend correctness is tested by the backend tests.

## How to Run Backend Tests

From the repo root:

```bash
cd src/api
source .venv/bin/activate
pip install -r requirements-dev.txt
pytest
```

The normal backend test command skips the slow real-model smoke test.

To run only the slow smoke test:

```bash
pytest -m slow
```

To run everything:

```bash
pytest -m "slow or not slow"
```

## How to Run Frontend Tests

From the repo root:

```bash
cd src/frontend
npm install
npm run test
```

To keep Vitest open and rerun tests while editing files:

```bash
npm run test:watch
```

If your local Node version is too old, use a newer Node version before running frontend tests. This project has been verified locally with Node 24.

## What to Do Before Pushing Code

Run the backend tests if you changed:

- `src/api/main.py`
- API response behavior
- model loading
- image validation
- prediction decision logic
- backend dependencies

Run the frontend tests if you changed:

- `src/frontend/components/Test.tsx`
- upload UI behavior
- detection history
- translation or disease guidance text
- frontend API response handling
- frontend dependencies

Run the frontend build if you changed frontend code:

```bash
cd src/frontend
npm run build
```

## What a Passing Test Run Means

A passing backend test run means the API behavior still matches the expected contract.

A passing frontend test run means the tested UI flows still work in a fake browser environment.

A passing slow smoke test means the shipped model can still load and produce probabilities.

## What Tests Do Not Prove

These tests do not prove that the model will classify every real maize image correctly.

Model accuracy depends on:

- training data quality
- validation and test results
- real-world image variety
- class balance
- model architecture and training settings

The tests protect the software around the model. Model quality still needs separate evaluation with test images and holdout images.

## What to Do When a Test Fails

Read the failure message first. It usually tells you which file and which expectation failed.

Common examples:

- If an API response shape changed, update the backend code or update the test if the new response is intentional.
- If prediction decision tests fail, check the accepted, likely, and rejected logic in `src/api/main.py`.
- If frontend upload tests fail, check the detector component and mocked API response shape.
- If history tests fail, check IndexedDB storage helpers.
- If the slow smoke test fails, check that `src/api/best_model.keras` and `src/api/class_names.json` are present and compatible.

Do not delete a failing test just to make the test suite pass. First decide whether the code is wrong or the test expectation is outdated.

## When to Add New Tests

Add a backend test when you change API behavior.

Add a frontend test when you change what users see or do in the browser.

Add a slow smoke or model-related test when you change shipped model files, class order, or model loading code.

Good tests are small and specific. They should explain one behavior clearly.
