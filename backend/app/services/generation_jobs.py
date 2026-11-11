from __future__ import annotations

import json
import logging
import threading
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session, sessionmaker

from app.database.session import SessionLocal
from app.models import GenerationJob
from app.services.godot_runner import GENERATED_SCENES_DIR, GodotRunnerError, run_godot_scene

logger = logging.getLogger(__name__)
_generation_lock = threading.Lock()


def create_job_session_factory(database_session: Session) -> sessionmaker[Session]:
    return sessionmaker(
        bind=database_session.get_bind(),
        autocommit=False,
        autoflush=False,
        expire_on_commit=False,
    )


def process_generation_job(
    job_id: str,
    session_factory: sessionmaker[Session] = SessionLocal,
    generated_root: Path = GENERATED_SCENES_DIR,
) -> None:
    with _generation_lock:
        db = session_factory()
        try:
            job = db.get(GenerationJob, job_id)
            if job is None or job.status != "queued":
                return

            job.status = "running"
            db.commit()
            prompt = job.prompt or ""

            try:
                scene_path = run_godot_scene(job_id, prompt, generated_root)
            except (GodotRunnerError, OSError) as error:
                logger.error("Scene generation failed for job %s: %s", job_id, error)
                job.status = "failed"
                job.output = json.dumps({"error": str(error)})
            else:
                relative_path = scene_path.relative_to(generated_root.resolve()).as_posix()
                job.status = "completed"
                job.output = json.dumps({"scene_path": relative_path})
            db.commit()
        finally:
            db.close()
