
from __future__ import annotations

import logging
import os
from datetime import datetime
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database.init_db import init_db
from app.database.session import SessionLocal
from app.models import Character as CharacterModel
from app.models import Project as ProjectModel
from app.models import RenderJob, Scene, Story as StoryModel
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
    genre: str = "Fantasy"
    art_style: str = "Cinematic 3D Anime"
    episode_duration: int = Field(default=24, ge=6, le=60)
    character_count: int = Field(default=4, ge=1, le=12)


class StoryItem(BaseModel):
    title: str
    description: str


class Story(BaseModel):
    id: str
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
    role: str = Field(default="Hero")
    personality: str = Field(default="Driven")
    appearance: str = Field(default="Modern-school silhouette")
    powers: str = Field(default="None")
    reference_image: str = Field(default="")


class Character(CharacterCreate):
    id: str
    created_at: str | None = None


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


def serialize_character(character: CharacterModel) -> dict[str, Any]:
    return {
        "id": character.id,
        "name": character.name,
        "role": character.role,
        "personality": character.personality,
        "appearance": character.appearance,
        "powers": character.powers,
        "reference_image": character.reference_image or "",
        "created_at": to_iso(character.created_at),
    }


def serialize_story(story: StoryModel) -> dict[str, Any]:
    outline = story.outline or []
    return {
        "id": story.id,
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
def list_stories(db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    stories = db.query(StoryModel).order_by(StoryModel.created_at.desc()).all()
    return [serialize_story(story) for story in stories]


@app.post("/api/stories/generate", status_code=201)
def generate_story(request: StoryGenerateRequest, db: Session = Depends(get_db)) -> dict[str, Any]:
    story_title = request.prompt.strip().split()[:5]
    title = " ".join(story_title).title() if story_title else "Story Draft"
    outline = build_story_outline(
        request.prompt,
        request.genre,
        request.art_style,
        request.episode_duration,
        request.character_count,
    )
    story = StoryModel(
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


@app.get("/api/characters")
def list_characters(db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    characters = db.query(CharacterModel).order_by(CharacterModel.created_at.desc()).all()
    return [serialize_character(character) for character in characters]


@app.get("/api/characters/{character_id}")
def get_character(character_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    character = db.get(CharacterModel, character_id)
    if character is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Character not found")
    return serialize_character(character)


@app.post("/api/characters", status_code=201)
def create_character(character: CharacterCreate, db: Session = Depends(get_db)) -> dict[str, Any]:
    model = CharacterModel(
        name=character.name,
        role=character.role,
        personality=character.personality,
        appearance=character.appearance,
        powers=character.powers,
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

    model.name = character.name
    model.role = character.role
    model.personality = character.personality
    model.appearance = character.appearance
    model.powers = character.powers
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
