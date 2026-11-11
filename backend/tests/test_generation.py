from __future__ import annotations

import json
import subprocess
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database.base import Base
from app.main import app, get_db
from app.models import GenerationJob, Project


@pytest.fixture()
def generation_client(tmp_path, monkeypatch):
    database_path = tmp_path / "generation_test.db"
    engine = create_engine(f"sqlite:///{database_path}", connect_args={"check_same_thread": False})
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    generated_root = tmp_path / "generated_scenes"
    monkeypatch.setattr("app.main.GENERATED_SCENES_DIR", generated_root)

    def override_get_db():
        db = session_factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as client:
        yield client, session_factory, generated_root
    app.dependency_overrides.clear()
    engine.dispose()


def create_project(session_factory) -> Project:
    db = session_factory()
    try:
        project = Project(name="Battle of Dawn", description="A test project", status="Concept", genre="Fantasy")
        db.add(project)
        db.commit()
        db.refresh(project)
        return project
    finally:
        db.close()


def mock_godot_success(monkeypatch, calls: list[list[str]]) -> None:
    monkeypatch.setenv("GODOT_EXECUTABLE", "godot-test.exe")
    monkeypatch.setattr("app.services.godot_runner.get_godot_executable", lambda: Path("godot-test.exe"))
    monkeypatch.setattr("app.main.get_godot_executable", lambda: Path("godot-test.exe"))

    def run(command, **kwargs):
        calls.append(command)
        input_path = Path(command[command.index("--input") + 1])
        payload = json.loads(input_path.read_text(encoding="utf-8"))
        output_dir = Path(payload["output_dir"])
        output_dir.mkdir(parents=True, exist_ok=True)
        (output_dir / "battlefield.tscn").write_text("[gd_scene format=3]\n", encoding="utf-8")
        return subprocess.CompletedProcess(command, 0, stdout="", stderr="")

    monkeypatch.setattr("app.services.godot_runner.subprocess.run", run)


def test_generation_job_lifecycle_and_scene_location(generation_client, monkeypatch):
    client, session_factory, generated_root = generation_client
    project = create_project(session_factory)
    calls: list[list[str]] = []
    mock_godot_success(monkeypatch, calls)

    submitted = client.post(
        f"/api/projects/{project.id}/generation-jobs",
        json={"prompt": "Two anime warriors clash on a ruined battlefield."},
    )
    assert submitted.status_code == 202
    queued = submitted.json()
    assert queued["status"] == "queued"
    assert "scene_url" not in queued

    job_response = client.get(f"/api/generation-jobs/{queued['id']}")
    assert job_response.status_code == 200
    completed = job_response.json()
    assert completed["status"] == "completed"
    assert completed["scene_url"] == f"/api/generation-jobs/{queued['id']}/scene"
    assert (generated_root / queued["id"] / "battlefield.tscn").is_file()

    scene_response = client.get(completed["scene_url"])
    assert scene_response.status_code == 200
    assert scene_response.content.startswith(b"[gd_scene")
    assert len(calls) == 1
    assert "Two anime warriors clash on a ruined battlefield." not in calls[0]
    assert calls[0][0] == "godot-test.exe"
    assert "--headless" in calls[0]


def test_generation_failure_is_persisted(generation_client, monkeypatch):
    client, session_factory, _ = generation_client
    project = create_project(session_factory)
    monkeypatch.setenv("GODOT_EXECUTABLE", "godot-test.exe")
    monkeypatch.setattr("app.services.godot_runner.get_godot_executable", lambda: Path("godot-test.exe"))
    monkeypatch.setattr(
        "app.services.godot_runner.subprocess.run",
        lambda command, **kwargs: subprocess.CompletedProcess(command, 5, stdout="", stderr="internal details"),
    )

    submitted = client.post(
        f"/api/projects/{project.id}/generation-jobs",
        json={"prompt": "A failed Godot run should be reported safely."},
    )
    assert submitted.status_code == 202

    job_response = client.get(f"/api/generation-jobs/{submitted.json()['id']}")
    assert job_response.status_code == 200
    assert job_response.json()["status"] == "failed"
    assert "code 5" in job_response.json()["error"]
    assert "internal details" not in job_response.text
    assert "generated_scenes" not in job_response.text


def test_generation_timeout_is_reported_as_failed(generation_client, monkeypatch):
    client, session_factory, _ = generation_client
    project = create_project(session_factory)
    monkeypatch.setattr("app.services.godot_runner.get_godot_executable", lambda: Path("godot-test.exe"))

    def timeout(command, **kwargs):
        raise subprocess.TimeoutExpired(command, kwargs["timeout"])

    monkeypatch.setattr("app.services.godot_runner.subprocess.run", timeout)

    submitted = client.post(
        f"/api/projects/{project.id}/generation-jobs",
        json={"prompt": "The scene generator should fail cleanly when it times out."},
    )
    job_response = client.get(f"/api/generation-jobs/{submitted.json()['id']}")

    assert job_response.status_code == 200
    assert job_response.json()["status"] == "failed"
    assert "timed out" in job_response.json()["error"]


def test_generation_rejects_missing_project(generation_client):
    client, _, _ = generation_client
    response = client.post(
        "/api/projects/missing-project/generation-jobs",
        json={"prompt": "A battle scene for a project that does not exist."},
    )
    assert response.status_code == 404


def test_open_generated_scene_uses_only_the_configured_godot_and_scene(
    generation_client,
    monkeypatch,
):
    client, session_factory, generated_root = generation_client
    project = create_project(session_factory)
    calls: list[list[str]] = []
    mock_godot_success(monkeypatch, calls)

    submitted = client.post(
        f"/api/projects/{project.id}/generation-jobs",
        json={"prompt": "Open the completed generated battlefield scene."},
    )
    job_id = submitted.json()["id"]
    open_calls = []
    monkeypatch.setattr("app.main.subprocess.Popen", lambda command, **kwargs: open_calls.append(command))

    response = client.post(f"/api/generation-jobs/{job_id}/open")
    assert response.status_code == 202
    assert response.json()["status"] == "opened"
    assert open_calls[0][0] == "godot-test.exe"
    assert open_calls[0][-1] == str(generated_root / job_id / "battlefield.tscn")
    assert "--script" not in open_calls[0]


def test_only_one_generation_process_runs_at_a_time(generation_client, monkeypatch):
    _, session_factory, generated_root = generation_client
    project = create_project(session_factory)
    db = session_factory()
    try:
        jobs = [
            GenerationJob(
                id=f"12345678-1234-4234-8234-123456789ab{index}",
                project_id=project.id,
                job_type="godot_scene",
                status="queued",
                prompt=f"Scene prompt {index}",
            )
            for index in (0, 1)
        ]
        db.add_all(jobs)
        db.commit()
        job_ids = [job.id for job in jobs]
    finally:
        db.close()

    active = 0
    maximum_active = 0
    counter_lock = threading.Lock()

    def fake_run(job_id, prompt, output_root):
        nonlocal active, maximum_active
        with counter_lock:
            active += 1
            maximum_active = max(maximum_active, active)
        time.sleep(0.03)
        scene_path = output_root / job_id / "battlefield.tscn"
        scene_path.parent.mkdir(parents=True, exist_ok=True)
        scene_path.write_text("[gd_scene format=3]\n", encoding="utf-8")
        with counter_lock:
            active -= 1
        return scene_path

    monkeypatch.setattr("app.services.generation_jobs.run_godot_scene", fake_run)
    from app.services.generation_jobs import process_generation_job

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [
            executor.submit(process_generation_job, job_id, session_factory, generated_root)
            for job_id in job_ids
        ]
        for future in futures:
            future.result()

    assert maximum_active == 1
    db = session_factory()
    try:
        assert all(db.get(GenerationJob, job_id).status == "completed" for job_id in job_ids)
    finally:
        db.close()
