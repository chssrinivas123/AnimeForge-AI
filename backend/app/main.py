
from __future__ import annotations

import logging
import json
import os
import subprocess
import uuid
from datetime import datetime
from typing import Any

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database.init_db import init_db
from app.database.session import SessionLocal
from app.models import Character as CharacterModel
from app.models import GenerationJob, Project as ProjectModel
from app.models import RenderJob, Scene, Shot, Story as StoryModel
from app.services.generation_jobs import create_job_session_factory, process_generation_job
from app.services.godot_runner import (
    GENERATED_SCENES_DIR,
    GODOT_PROJECT_DIR,
    GodotRunnerError,
    get_godot_executable,
    get_scene_path,
)
from app.services.story_service import build_story_outline

logger = logging.getLogger(__name__)

app = FastAPI(
    title="AnimeForge AI",
    description="AI-powered 3D Anime Production Platform",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=120)
    description: str = Field(default="", max_length=800)
    status: str = "Concept"
    genre: str = "Fantasy"


class Project(ProjectCreate):
    id: str
    created_at: str | None = None
    updated_at: str | None = None


class StoryGenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=10, max_length=1500)
    title: str | None = Field(default=None, min_length=1, max_length=180)
    project_id: str | None = None
    genre: str = "Fantasy"
    tone: str = "Dramatic"
    art_style: str = "Cinematic 3D Anime"
    episode_duration: int = Field(default=24, ge=6, le=60)
    character_count: int = Field(default=4, ge=1, le=12)


class SceneGenerationRequest(BaseModel):
    prompt: str = Field(..., min_length=10, max_length=1500)


class StoryItem(BaseModel):
    title: str
    description: str


class StoryUpdateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=180)
    prompt: str = Field(..., min_length=1, max_length=1500)
    genre: str = Field(..., max_length=50)
    art_style: str = Field(..., max_length=120)
    episode_duration: int = Field(..., ge=6, le=60)
    character_count: int = Field(..., ge=1, le=12)
    outline: list[StoryItem]


class Story(BaseModel):
    id: str
    project_id: str | None = None
    title: str
    prompt: str
    genre: str
    art_style: str
    episode_duration: int
    character_count: int
    outline: list[StoryItem]
    created_at: str | None = None


class CharacterCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    project_id: str | None = None
    role: str = Field(default="Hero")
    personality: str = Field(default="Driven")
    appearance: str = Field(default="Modern-school silhouette")
    description: str | None = Field(default=None, max_length=2000)
    powers: str = Field(default="None")
    weapon: str | None = Field(default=None, max_length=500)
    reference_image: str = Field(default="")


class Character(CharacterCreate):
    id: str
    created_at: str | None = None


class SceneCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    description: str = Field(default="", max_length=3000)


class SceneUpdate(SceneCreate):
    pass


class ShotCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=180)
    description: str = Field(default="", max_length=3000)
    camera_angle: str = Field(default="Wide", max_length=120)
    camera_movement: str = Field(default="Static", max_length=120)
    duration: int = Field(default=6, ge=1, le=600)
    character_involvement: str = Field(default="", max_length=1000)
    visual_effects: str = Field(default="", max_length=1000)
    ordering: int = Field(default=1, ge=1)


class ShotUpdate(ShotCreate):
    pass


class AuthUser(BaseModel):
    email: str
    name: str
    role: str = "Producer"


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.on_event("startup")
def startup_event() -> None:
    if "PYTEST_CURRENT_TEST" in os.environ:
        logger.info("Skipping startup database initialization during pytest execution.")
        return

    try:
        init_db()
    except SQLAlchemyError:
        logger.exception("Failed to initialize database. Application will run in degraded mode.")


def to_iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.isoformat(timespec="seconds")


def serialize_project(project: ProjectModel) -> dict[str, Any]:
    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "status": project.status,
        "genre": project.genre,
        "created_at": to_iso(project.created_at),
        "updated_at": to_iso(project.updated_at),
    }


def serialize_scene(scene: Scene) -> dict[str, Any]:
    shots = sorted(scene.shots, key=lambda shot: (shot.ordering, shot.created_at))
    return {
        "id": scene.id,
        "project_id": scene.project_id,
        "name": scene.name,
        "description": scene.description,
        "created_at": to_iso(scene.created_at),
        "shots": [serialize_shot(shot) for shot in shots],
    }


def serialize_shot(shot: Shot) -> dict[str, Any]:
    return {
        "id": shot.id,
        "scene_id": shot.scene_id,
        "title": shot.title,
        "description": shot.description,
        "camera_angle": shot.camera_angle,
        "camera_movement": shot.camera_movement,
        "duration": shot.duration,
        "character_involvement": shot.character_involvement,
        "visual_effects": shot.visual_effects,
        "ordering": shot.ordering,
        "created_at": to_iso(shot.created_at),
    }


def serialize_character(character: CharacterModel) -> dict[str, Any]:
    appearance, description = decode_profile_field(character.appearance)
    powers, weapon = decode_profile_field(character.powers)
    return {
        "id": character.id,
        "project_id": character.project_id,
        "name": character.name,
        "role": character.role,
        "personality": character.personality,
        "appearance": appearance,
        "description": description,
        "powers": powers,
        "weapon": weapon,
        "reference_image": character.reference_image or "",
        "created_at": to_iso(character.created_at),
    }


def serialize_story(story: StoryModel) -> dict[str, Any]:
    outline = story.outline or []
    return {
        "id": story.id,
        "project_id": story.project_id,
        "title": story.title,
        "prompt": story.prompt,
        "genre": story.genre,
        "art_style": story.art_style,
        "episode_duration": story.episode_duration,
        "character_count": story.character_count,
        "outline": [
            {"title": item.get("title", "Scene"), "description": item.get("description", "")}
            for item in outline
        ],
        "created_at": to_iso(story.created_at),
    }


PROFILE_FIELD_PREFIX = "animeforge-profile:v1:"


def encode_profile_field(primary: str, secondary: str | None) -> str:
    if not secondary:
        return primary
    return PROFILE_FIELD_PREFIX + json.dumps(
        {"primary": primary, "secondary": secondary},
        ensure_ascii=False,
    )


def decode_profile_field(value: str) -> tuple[str, str]:
    if not value.startswith(PROFILE_FIELD_PREFIX):
        return value, ""
    try:
        payload = json.loads(value[len(PROFILE_FIELD_PREFIX):])
    except json.JSONDecodeError:
        return value, ""
    if not isinstance(payload, dict):
        return value, ""
    return str(payload.get("primary", "")), str(payload.get("secondary", ""))


def serialize_generation_job(job: GenerationJob) -> dict[str, Any]:
    result: dict[str, Any] = {
        "id": job.id,
        "project_id": job.project_id,
        "status": job.status,
        "created_at": to_iso(job.created_at),
        "updated_at": to_iso(job.updated_at),
    }
    if job.status == "completed":
        result["scene_url"] = f"/api/generation-jobs/{job.id}/scene"
    elif job.status == "failed":
        try:
            output = json.loads(job.output or "{}")
        except json.JSONDecodeError:
            output = {}
        result["error"] = output.get("error", "Scene generation failed.")
    return result


@app.get("/")
def home() -> dict[str, str]:
    return {"message": "Welcome to AnimeForge AI!", "status": "Backend is running"}


@app.get("/api/health")
def health_check() -> dict[str, str]:
    return {"status": "healthy", "application": "AnimeForge AI"}


@app.get("/api/dashboard")
def dashboard(db: Session = Depends(get_db)) -> dict[str, Any]:
    projects = db.query(ProjectModel).order_by(ProjectModel.created_at.desc()).limit(3).all()
    characters = db.query(CharacterModel).count()
    scenes = db.query(Scene).count()
    completed_renders = db.query(RenderJob).filter(RenderJob.status == "completed").count()

    return {
        "totalProjects": db.query(ProjectModel).count(),
        "totalCharacters": characters,
        "totalScenes": scenes,
        "completedRenders": completed_renders,
        "projects": [serialize_project(project) for project in projects],
        "activity": [
            {"title": "Storyboard approved", "detail": "Episode 02 used the cinematic dev preview.", "time": "2h ago"},
            {"title": "New character unlocked", "detail": "Ari Sol was added to the prototype cast.", "time": "5h ago"},
            {"title": "Render queued", "detail": "Final shot package is waiting on GPU approval.", "time": "1d ago"},
        ],
    }


@app.get("/api/projects")
def list_projects(db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    projects = db.query(ProjectModel).order_by(ProjectModel.created_at.desc()).all()
    return [serialize_project(project) for project in projects]


@app.get("/api/projects/{project_id}")
def get_project(project_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    project = db.get(ProjectModel, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return serialize_project(project)


@app.post("/api/projects", status_code=201)
def create_project(project: ProjectCreate, db: Session = Depends(get_db)) -> dict[str, Any]:
    model = ProjectModel(
        name=project.name,
        description=project.description,
        status=project.status,
        genre=project.genre,
    )
    db.add(model)
    db.commit()
    db.refresh(model)
    return serialize_project(model)


@app.put("/api/projects/{project_id}")
def update_project(project_id: str, project: ProjectCreate, db: Session = Depends(get_db)) -> dict[str, Any]:
    model = db.get(ProjectModel, project_id)
    if model is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    model.name = project.name
    model.description = project.description
    model.status = project.status
    model.genre = project.genre
    db.commit()
    db.refresh(model)
    return serialize_project(model)


@app.delete("/api/projects/{project_id}")
def delete_project(project_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    model = db.get(ProjectModel, project_id)
    if model is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    db.delete(model)
    db.commit()
    return {"message": "Project deleted", "id": project_id}


@app.get("/api/stories")
def list_stories(project_id: str | None = None, db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    query = db.query(StoryModel)
    if project_id is not None:
        query = query.filter(StoryModel.project_id == project_id)
    stories = query.order_by(StoryModel.created_at.desc()).all()
    return [serialize_story(story) for story in stories]


@app.post("/api/stories/generate", status_code=201)
def generate_story(request: StoryGenerateRequest, db: Session = Depends(get_db)) -> dict[str, Any]:
    if request.project_id is not None and db.get(ProjectModel, request.project_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    story_title = request.prompt.strip().split()[:5]
    title = request.title.strip() if request.title else (" ".join(story_title).title() if story_title else "Story Draft")
    outline = build_story_outline(
        request.prompt,
        request.genre,
        request.art_style,
        request.episode_duration,
        request.character_count,
        request.tone,
    )
    story = StoryModel(
        project_id=request.project_id,
        title=title,
        prompt=request.prompt,
        genre=request.genre,
        art_style=request.art_style,
        episode_duration=request.episode_duration,
        character_count=request.character_count,
        outline=outline,
    )
    db.add(story)
    db.commit()
    db.refresh(story)
    return serialize_story(story)


@app.put("/api/stories/{story_id}")
def update_story(
    story_id: str,
    story: StoryUpdateRequest,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    model = db.get(StoryModel, story_id)
    if model is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Story not found")

    model.title = story.title.strip()
    model.prompt = story.prompt
    model.genre = story.genre
    model.art_style = story.art_style
    model.episode_duration = story.episode_duration
    model.character_count = story.character_count
    model.outline = [item.model_dump() for item in story.outline]
    db.commit()
    db.refresh(model)
    return serialize_story(model)


@app.get("/api/projects/{project_id}/scenes")
def list_project_scenes(project_id: str, db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    if db.get(ProjectModel, project_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    scenes = (
        db.query(Scene)
        .filter(Scene.project_id == project_id)
        .order_by(Scene.created_at.asc())
        .all()
    )
    return [serialize_scene(scene) for scene in scenes]


@app.post("/api/projects/{project_id}/scenes", status_code=201)
def create_scene(
    project_id: str,
    scene: SceneCreate,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    if db.get(ProjectModel, project_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    model = Scene(project_id=project_id, name=scene.name.strip(), description=scene.description)
    db.add(model)
    db.commit()
    db.refresh(model)
    return serialize_scene(model)


@app.put("/api/scenes/{scene_id}")
def update_scene(scene_id: str, scene: SceneUpdate, db: Session = Depends(get_db)) -> dict[str, Any]:
    model = db.get(Scene, scene_id)
    if model is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scene not found")
    model.name = scene.name.strip()
    model.description = scene.description
    db.commit()
    db.refresh(model)
    return serialize_scene(model)


@app.delete("/api/scenes/{scene_id}")
def delete_scene(scene_id: str, db: Session = Depends(get_db)) -> dict[str, str]:
    model = db.get(Scene, scene_id)
    if model is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scene not found")
    db.delete(model)
    db.commit()
    return {"message": "Scene deleted", "id": scene_id}


@app.post("/api/scenes/{scene_id}/shots", status_code=201)
def create_shot(scene_id: str, shot: ShotCreate, db: Session = Depends(get_db)) -> dict[str, Any]:
    if db.get(Scene, scene_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scene not found")
    model = Shot(scene_id=scene_id, **shot.model_dump())
    db.add(model)
    db.commit()
    db.refresh(model)
    return serialize_shot(model)


@app.put("/api/shots/{shot_id}")
def update_shot(shot_id: str, shot: ShotUpdate, db: Session = Depends(get_db)) -> dict[str, Any]:
    model = db.get(Shot, shot_id)
    if model is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shot not found")
    for field, value in shot.model_dump().items():
        setattr(model, field, value)
    db.commit()
    db.refresh(model)
    return serialize_shot(model)


@app.delete("/api/shots/{shot_id}")
def delete_shot(shot_id: str, db: Session = Depends(get_db)) -> dict[str, str]:
    model = db.get(Shot, shot_id)
    if model is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shot not found")
    db.delete(model)
    db.commit()
    return {"message": "Shot deleted", "id": shot_id}


@app.post("/api/projects/{project_id}/generation-jobs", status_code=status.HTTP_202_ACCEPTED)
def create_scene_generation_job(
    project_id: str,
    request: SceneGenerationRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    project = db.get(ProjectModel, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    job = GenerationJob(
        id=str(uuid.uuid4()),
        project_id=project_id,
        job_type="godot_scene",
        status="queued",
        prompt=request.prompt.strip(),
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    background_tasks.add_task(
        process_generation_job,
        job.id,
        create_job_session_factory(db),
        GENERATED_SCENES_DIR,
    )
    return serialize_generation_job(job)


@app.get("/api/generation-jobs/{job_id}")
def get_generation_job(job_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    job = db.get(GenerationJob, job_id)
    if job is None or job.job_type != "godot_scene":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Generation job not found")
    return serialize_generation_job(job)


@app.get("/api/generation-jobs/{job_id}/scene")
def get_generated_scene(job_id: str, db: Session = Depends(get_db)) -> FileResponse:
    job = db.get(GenerationJob, job_id)
    if job is None or job.job_type != "godot_scene" or job.status != "completed":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Generated scene not found")

    try:
        scene_path = get_scene_path(job_id, GENERATED_SCENES_DIR)
    except GodotRunnerError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Generated scene not found") from error
    if not scene_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Generated scene not found")
    return FileResponse(scene_path, media_type="application/octet-stream", filename="battlefield.tscn")


@app.post("/api/generation-jobs/{job_id}/open", status_code=status.HTTP_202_ACCEPTED)
def open_generated_scene(job_id: str, db: Session = Depends(get_db)) -> dict[str, str]:
    job = db.get(GenerationJob, job_id)
    if job is None or job.job_type != "godot_scene" or job.status != "completed":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Generated scene not found")

    try:
        scene_path = get_scene_path(job_id, GENERATED_SCENES_DIR)
        executable = get_godot_executable()
    except GodotRunnerError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Godot is not configured or the scene is unavailable.",
        ) from error
    if not scene_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Generated scene not found")

    try:
        subprocess.Popen(
            [str(executable), "--path", str(GODOT_PROJECT_DIR), str(scene_path)],
            cwd=GODOT_PROJECT_DIR,
            close_fds=True,
        )
    except OSError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not open the generated scene in Godot.",
        ) from error
    return {"status": "opened", "message": "Godot is opening the generated scene."}


@app.get("/api/characters")
def list_characters(project_id: str | None = None, db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    query = db.query(CharacterModel)
    if project_id is not None:
        query = query.filter(CharacterModel.project_id == project_id)
    characters = query.order_by(CharacterModel.created_at.desc()).all()
    return [serialize_character(character) for character in characters]


@app.get("/api/characters/{character_id}")
def get_character(character_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    character = db.get(CharacterModel, character_id)
    if character is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Character not found")
    return serialize_character(character)


@app.post("/api/characters", status_code=201)
def create_character(character: CharacterCreate, db: Session = Depends(get_db)) -> dict[str, Any]:
    if character.project_id is not None and db.get(ProjectModel, character.project_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    model = CharacterModel(
        project_id=character.project_id,
        name=character.name,
        role=character.role,
        personality=character.personality,
        appearance=encode_profile_field(character.appearance, character.description),
        powers=encode_profile_field(character.powers, character.weapon),
        reference_image=character.reference_image,
    )
    db.add(model)
    db.commit()
    db.refresh(model)
    return serialize_character(model)


@app.put("/api/characters/{character_id}")
def update_character(character_id: str, character: CharacterCreate, db: Session = Depends(get_db)) -> dict[str, Any]:
    model = db.get(CharacterModel, character_id)
    if model is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Character not found")
    if character.project_id is not None and db.get(ProjectModel, character.project_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    model.name = character.name
    model.role = character.role
    model.personality = character.personality
    _, existing_description = decode_profile_field(model.appearance)
    _, existing_weapon = decode_profile_field(model.powers)
    model.project_id = character.project_id or model.project_id
    model.appearance = encode_profile_field(
        character.appearance,
        character.description if character.description is not None else existing_description,
    )
    model.powers = encode_profile_field(
        character.powers,
        character.weapon if character.weapon is not None else existing_weapon,
    )
    model.reference_image = character.reference_image
    db.commit()
    db.refresh(model)
    return serialize_character(model)


@app.delete("/api/characters/{character_id}")
def delete_character(character_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    model = db.get(CharacterModel, character_id)
    if model is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Character not found")

    db.delete(model)
    db.commit()
    return {"message": "Character deleted", "id": character_id}


@app.get("/api/settings")
def settings() -> dict[str, Any]:
    return {
        "project_name": "AnimeForge AI",
        "backend_status": "online",
        "database_status": "MySQL 8 via SQLAlchemy",
        "blender_status": "not detected",
        "application_config": {
            "theme": "dark-anime-studio",
            "demo_generation": True,
            "local_storage": "Browser session",
        },
    }


@app.post("/api/auth/register")
def register() -> dict[str, Any]:
    return {
        "message": "Registration successful",
        "user": {"email": "producer@animeforge.ai", "name": "Studio Producer", "role": "Producer"},
    }


@app.post("/api/auth/login")
def login() -> dict[str, Any]:
    return {
        "message": "Login successful",
        "user": {"email": "producer@animeforge.ai", "name": "Studio Producer", "role": "Producer"},
    }


@app.get("/api/auth/me")
def current_user() -> AuthUser:
    return AuthUser(email="producer@animeforge.ai", name="Studio Producer", role="Producer")
