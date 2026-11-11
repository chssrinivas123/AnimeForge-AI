from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "healthy"
    assert payload["application"] == "AnimeForge AI"


def test_project_crud_round_trip():
    create_response = client.post(
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

    list_response = client.get("/api/projects")
    assert list_response.status_code == 200
    assert any(project["id"] == project_id for project in list_response.json())

    update_response = client.put(
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

    delete_response = client.delete(f"/api/projects/{project_id}")
    assert delete_response.status_code == 200
    assert delete_response.json()["id"] == project_id


def test_story_generation_creates_outline():
    response = client.post(
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
