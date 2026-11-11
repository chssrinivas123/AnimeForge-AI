# AnimeForge AI MVP

This project contains a lightweight MVP for the AnimeForge AI platform, including a FastAPI backend and a Vite + React frontend.

## Features

- Dark anime-studio dashboard with KPI cards and recent activity
- Project management with create, list, update, and delete actions
- Deterministic story-generation demo with outline output
- Character studio for reusable cast members
- Settings and production status panels
- Exposed backend API for health, dashboard, projects, stories, characters, and auth demo endpoints

## Run locally

### Backend

```bash
cd backend
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```

## Validation

```bash
cd backend
.venv\Scripts\python.exe -m pytest tests/test_api.py -q

cd ../frontend
npm run build
```
