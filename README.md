# AnimeForge AI MVP

This project contains a FastAPI backend and a React + Vite frontend for a cinematic anime production dashboard.

## Current persistence status

- Real SQLAlchemy persistence is implemented for the project, story, character, scene, shot, asset, generation job, and render job models when MySQL config is supplied.
- Demo/local fallback behavior remains in place when database credentials are not configured, so local development and tests remain runnable without inventing values.
- The frontend uses live backend APIs when available and falls back to browser-local storage when the backend is offline.

## MySQL setup

1. Install MySQL 8 locally.
2. Create the database:

```sql
CREATE DATABASE animeforge_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

3. Create an application user if needed:

```sql
CREATE USER 'animeforge'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON animeforge_db.* TO 'animeforge'@'localhost';
FLUSH PRIVILEGES;
```

4. Copy the example environment file and update it with your own credentials:

```bash
cd backend
copy .env.example .env
```

Use your actual values in `.env`:

```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=animeforge
MYSQL_PASSWORD=your_password
MYSQL_DB=animeforge_db
```

You can also set `DATABASE_URL` directly:

```env
DATABASE_URL=mysql+pymysql://animeforge:your_password@localhost:3306/animeforge_db?charset=utf8mb4
```

Do not commit real credentials. Keep `.env` local only.

## Database initialization

The backend initializes the schema safely on startup with SQLAlchemy metadata creation. It creates any missing tables without dropping existing data.

```bash
cd backend
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

If you prefer explicit migration tooling, you can install Alembic and use:

```bash
cd backend
.venv\Scripts\python.exe -m pip install alembic
.venv\Scripts\python.exe -m alembic init alembic
.venv\Scripts\python.exe -m alembic revision --autogenerate -m "initial schema"
.venv\Scripts\python.exe -m alembic upgrade head
```

## Backend startup

```bash
cd backend
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

## Frontend startup

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```

## Godot procedural scene generation

The Godot 4.7.2 project in `godot/` creates a lightweight battlefield scene using built-in meshes and materials. The first generator uses the submitted description as scene metadata and creates a fixed procedural layout; it does not interpret arbitrary prompts with an AI model.

Configure `GODOT_EXECUTABLE` in the backend process environment. For the supplied Windows download, the executable is inside the directory that shares its name:

```powershell
$env:GODOT_EXECUTABLE = "C:\Users\SRINIVAS\Downloads\Godot_v4.7.2-stable_win64.exe\Godot_v4.7.2-stable_win64.exe"
```

The backend runs one Godot generation at a time per generated-scenes directory. Start a single Uvicorn worker (do not add `--workers`):

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Create a job with `POST /api/projects/{project_id}/generation-jobs` and JSON body `{"prompt":"..."}`. Poll `GET /api/generation-jobs/{job_id}` for `queued`, `running`, `completed`, or `failed`. A completed job provides a `scene_url`; `POST /api/generation-jobs/{job_id}/open` opens that generated scene in Godot on the backend host. Generated `.tscn` files are stored under `backend/generated_scenes/<job_id>/`.

The renderer uses Godot's Compatibility renderer and simple low-poly geometry for integrated graphics. Headless generation validates and writes the scene but does not visually render or inspect it.

## Testing

Run the backend API tests and database integration tests:

```bash
cd backend
.venv\Scripts\python.exe -m pytest tests/test_api.py tests/test_db.py -q
```

Run the frontend production build:

```bash
cd frontend
npm run build
```

## Validation

```bash
cd backend
.venv\Scripts\python.exe -m pytest tests/test_api.py tests/test_db.py -q

cd ../frontend
npm run build
```
