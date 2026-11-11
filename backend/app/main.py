
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

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


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=120)
    description: str = Field(default="", max_length=800)
    status: str = "Concept"
    genre: str = "Fantasy"


class Project(ProjectCreate):
    id: str
    created_at: str
    updated_at: str


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
    created_at: str


class CharacterCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    role: str = Field(default="Hero")
    personality: str = Field(default="Driven")
    appearance: str = Field(default="Modern-school silhouette")
    powers: str = Field(default="None")
    reference_image: str = Field(default="")


class Character(CharacterCreate):
    id: str
    created_at: str


class AuthUser(BaseModel):
    email: str
    name: str
    role: str = "Producer"


projects: list[Project] = [
    Project(
        id="proj-1",
        name="Moonlit Vanguard",
        description="A rogue squad of celestial guardians protects a dying city in a crystal sky."
        ,
        status="In Progress",
        genre="Sci-Fi",
        created_at=utc_now(),
        updated_at=utc_now(),
    ),
    Project(
        id="proj-2",
        name="Skybound Archive",
        description="A fallen archivist discovers lost memories inside floating ruins.",
        status="Storyboarding",
        genre="Fantasy",
        created_at=utc_now(),
        updated_at=utc_now(),
    ),
]

stories: list[Story] = [
    Story(
        id="story-1",
        title="Moonlit Vanguard",
        prompt="A young pilot learns to control a celestial mech to save a city drifting above the clouds.",
        genre="Sci-Fi",
        art_style="Cinematic 3D Anime",
        episode_duration=24,
        character_count=5,
        outline=[
            StoryItem(title="Act I", description="The city begins to lose gravity and the pilot is recruited for a risky rescue."),
            StoryItem(title="Act II", description="A hidden rebellion reveals the mechanical heart that powers the city."),
            StoryItem(title="Act III", description="The pilot sacrifices their freedom to save the city and protect its citizens."),
        ],
        created_at=utc_now(),
    )
]

characters: list[Character] = [
    Character(
        id="char-1",
        name="Ari Sol",
        role="Hero",
        personality="Brave and stubborn",
        appearance="Silver hair, cyan visor, layered combat coat",
        powers="Stellar pulse dash",
        reference_image="",
        created_at=utc_now(),
    )
]


def build_story_outline(prompt: str, genre: str, art_style: str, episode_duration: int, character_count: int) -> list[StoryItem]:
    clean_prompt = prompt.strip()
    title_anchor = clean_prompt.split()[:6]
    title = " ".join(title_anchor).title() if title_anchor else "New Story"

    return [
        StoryItem(
            title="Opening Hook",
            description=f"{title} begins with a cinematic reveal of the world and the central conflict in a {genre.lower()} setting.",
        ),
        StoryItem(
            title="Character Arc",
            description=f"{character_count} core characters navigate loyalty, identity, and sacrifice while the art direction stays {art_style.lower()}.",
        ),
        StoryItem(
            title="Crescendo",
            description=f"At {episode_duration} minutes, the story locks into a high-stakes battle that resolves the emotional threads and leads to a hopeful or tragic finale.",
        ),
        StoryItem(
            title="Visual Breakdown",
            description="Scene beats are staged for dynamic camera motion, layered VFX, and emotionally grounded anime dialogue pacing.",
        ),
    ]


@app.get("/")
def home() -> dict[str, str]:
    return {
        "message": "Welcome to AnimeForge AI!",
        "status": "Backend is running",
    }


@app.get("/api/health")
def health_check() -> dict[str, str]:
    return {
        "status": "healthy",
        "application": "AnimeForge AI",
    }


@app.get("/api/dashboard")
def dashboard() -> dict[str, Any]:
    return {
        "totalProjects": len(projects),
        "totalCharacters": len(characters),
        "totalScenes": 18,
        "completedRenders": 7,
        "projects": projects[:3],
        "activity": [
            {"title": "Storyboard approved", "detail": "Episode 02 used the cinematic dev preview.", "time": "2h ago"},
            {"title": "New character unlocked", "detail": "Ari Sol was added to the prototype cast.", "time": "5h ago"},
            {"title": "Render queued", "detail": "Final shot package is waiting on GPU approval.", "time": "1d ago"},
        ],
    }


@app.get("/api/projects")
def list_projects() -> list[Project]:
    return projects


@app.post("/api/projects", status_code=201)
def create_project(project: ProjectCreate) -> Project:
    new_project = Project(
        id=f"proj-{uuid4().hex[:8]}",
        name=project.name,
        description=project.description,
        status=project.status,
        genre=project.genre,
        created_at=utc_now(),
        updated_at=utc_now(),
    )
    projects.append(new_project)
    return new_project


@app.put("/api/projects/{project_id}")
def update_project(project_id: str, project: ProjectCreate) -> Project:
    for current in projects:
        if current.id == project_id:
            current.name = project.name
            current.description = project.description
            current.status = project.status
            current.genre = project.genre
            current.updated_at = utc_now()
            return current
    raise HTTPException(status_code=404, detail="Project not found")


@app.delete("/api/projects/{project_id}")
def delete_project(project_id: str) -> dict[str, Any]:
    for index, current in enumerate(projects):
        if current.id == project_id:
            del projects[index]
            return {"message": "Project deleted", "id": project_id}
    raise HTTPException(status_code=404, detail="Project not found")


@app.get("/api/stories")
def list_stories() -> list[Story]:
    return stories


@app.post("/api/stories/generate", status_code=201)
def generate_story(request: StoryGenerateRequest) -> Story:
    title_words = request.prompt.strip().split()[:5]
    story_title = " ".join(title_words).title() if title_words else "Story Draft"
    story = Story(
        id=f"story-{uuid4().hex[:8]}",
        title=story_title,
        prompt=request.prompt,
        genre=request.genre,
        art_style=request.art_style,
        episode_duration=request.episode_duration,
        character_count=request.character_count,
        outline=build_story_outline(
            request.prompt,
            request.genre,
            request.art_style,
            request.episode_duration,
            request.character_count,
        ),
        created_at=utc_now(),
    )
    stories.insert(0, story)
    return story


@app.get("/api/characters")
def list_characters() -> list[Character]:
    return characters


@app.post("/api/characters", status_code=201)
def create_character(character: CharacterCreate) -> Character:
    new_character = Character(
        id=f"char-{uuid4().hex[:8]}",
        name=character.name,
        role=character.role,
        personality=character.personality,
        appearance=character.appearance,
        powers=character.powers,
        reference_image=character.reference_image,
        created_at=utc_now(),
    )
    characters.append(new_character)
    return new_character


@app.get("/api/settings")
def settings() -> dict[str, Any]:
    return {
        "project_name": "AnimeForge AI",
        "backend_status": "online",
        "database_status": "demo-memory-mode",
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
