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


def test_project_scoped_production_workflow(client_with_isolated_db):
    client = client_with_isolated_db
    project_response = client.post(
        "/api/projects",
        json={"name": "Cinder Line", "description": "A test story.", "genre": "Fantasy"},
    )
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]

    story_response = client.post(
        "/api/stories/generate",
        json={
            "project_id": project_id,
            "title": "Cinder Line",
            "prompt": "Two siblings defend their city from a nightfall curse.",
            "genre": "Fantasy",
            "tone": "Hopeful",
        },
    )
    assert story_response.status_code == 201
    story = story_response.json()
    assert story["project_id"] == project_id
    assert story["title"] == "Cinder Line"
    assert "hopeful tone" in story["outline"][0]["description"]
    assert len(client.get(f"/api/stories?project_id={project_id}").json()) == 1

    story["title"] = "Cinder Line: Dawn"
    story["outline"][0]["description"] = "A revised opening."
    updated_story = client.put(f"/api/stories/{story['id']}", json=story)
    assert updated_story.status_code == 200
    assert updated_story.json()["outline"][0]["description"] == "A revised opening."

    character_response = client.post(
        "/api/characters",
        json={
            "project_id": project_id,
            "name": "Mira",
            "appearance": "Silver braid",
            "description": "A careful scout.",
            "personality": "Patient",
            "powers": "Wind shaping",
            "weapon": "Short bow",
        },
    )
    assert character_response.status_code == 201
    character = character_response.json()
    assert character["project_id"] == project_id
    assert character["description"] == "A careful scout."
    assert character["weapon"] == "Short bow"
    assert len(client.get(f"/api/characters?project_id={project_id}").json()) == 1

    scene_response = client.post(
        f"/api/projects/{project_id}/scenes",
        json={"name": "Ruined Gate", "description": "The city's western entrance."},
    )
    assert scene_response.status_code == 201
    scene_id = scene_response.json()["id"]
    shot_response = client.post(
        f"/api/scenes/{scene_id}/shots",
        json={
            "title": "Gate reveal",
            "description": "The siblings enter the ruined gate.",
            "camera_angle": "Wide",
            "duration": 8,
            "character_involvement": "Mira and Ren",
        },
    )
    assert shot_response.status_code == 201
    shot_id = shot_response.json()["id"]

    storyboard = client.get(f"/api/projects/{project_id}/scenes")
    assert storyboard.status_code == 200
    assert storyboard.json()[0]["shots"][0]["id"] == shot_id

    updated_scene = client.put(
        f"/api/scenes/{scene_id}",
        json={"name": "The Ruined Gate", "description": "Updated scene description."},
    )
    assert updated_scene.status_code == 200
    updated_shot = client.put(
        f"/api/shots/{shot_id}",
        json={
            "title": "Gate reveal",
            "description": "A slow reveal of the siblings.",
            "camera_angle": "Low",
            "duration": 10,
            "character_involvement": "Mira",
        },
    )
    assert updated_shot.status_code == 200
    assert updated_shot.json()["camera_angle"] == "Low"
