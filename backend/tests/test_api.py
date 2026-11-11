from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database.base import Base
from app.main import app, get_db


@pytest.fixture()
def client_with_isolated_db(tmp_path):
    db_path = tmp_path / "animeforge_api_test.db"
    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    SessionLocalForTest = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = SessionLocalForTest()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()
    engine.dispose()


def test_health_check(client_with_isolated_db):
    response = client_with_isolated_db.get("/api/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "healthy"
    assert payload["application"] == "AnimeForge AI"


def test_project_crud_round_trip(client_with_isolated_db):
    create_response = client_with_isolated_db.post(
        "/api/projects",
        json={
            "name": "Solar Echo",
            "description": "A city powered by a lost sun crystal fights against the night.",
            "status": "Concept",
            "genre": "Fantasy",
        },
    )
    assert create_response.status_code == 201
    created = create_response.json()
    project_id = created["id"]
    assert created["name"] == "Solar Echo"

    list_response = client_with_isolated_db.get("/api/projects")
    assert list_response.status_code == 200
    assert any(project["id"] == project_id for project in list_response.json())

    update_response = client_with_isolated_db.put(
        f"/api/projects/{project_id}",
        json={
            "name": "Solar Echo",
            "description": "A city powered by a lost sun crystal fights against the night.",
            "status": "Storyboard",
            "genre": "Fantasy",
        },
    )
    assert update_response.status_code == 200
    assert update_response.json()["status"] == "Storyboard"

    delete_response = client_with_isolated_db.delete(f"/api/projects/{project_id}")
    assert delete_response.status_code == 200
    assert delete_response.json()["id"] == project_id


def test_story_generation_creates_outline(client_with_isolated_db):
    response = client_with_isolated_db.post(
        "/api/stories/generate",
        json={
            "prompt": "A young guardian must restore a shattered moon to save an island kingdom from a cursed eclipse.",
            "genre": "Fantasy",
            "art_style": "Cinematic 3D Anime",
            "episode_duration": 24,
            "character_count": 4,
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["genre"] == "Fantasy"
    assert len(data["outline"]) >= 3
    assert data["title"]


def test_missing_records_return_404(client_with_isolated_db):
    missing_project = client_with_isolated_db.get("/api/projects/missing-id")
    assert missing_project.status_code == 404

    missing_character = client_with_isolated_db.get("/api/characters/missing-id")
    assert missing_character.status_code == 404
