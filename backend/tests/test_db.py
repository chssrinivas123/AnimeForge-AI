from __future__ import annotations

import pytest
from sqlalchemy import create_engine, inspect
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from app.database.base import Base
from app.main import app, get_db
from app.models import Character, Project, Scene, Shot, User


@pytest.fixture()
def isolated_db(tmp_path):
    db_path = tmp_path / "animeforge_test.db"
    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    yield {"engine": engine, "SessionLocal": SessionLocal}
    app.dependency_overrides.clear()
    engine.dispose()


def test_project_and_character_crud(isolated_db):
    session = isolated_db["SessionLocal"]()
    try:
        project = Project(name="Solar Echo", description="A city under the eclipse", status="Concept", genre="Fantasy")
        session.add(project)
        session.commit()
        session.refresh(project)

        character = Character(
            project_id=project.id,
            name="Aoi Kazumi",
            role="Hero",
            personality="Brave",
            appearance="Blue coat",
            powers="Luna burst",
        )
        session.add(character)
        session.commit()
        session.refresh(character)

        stored_project = session.get(Project, project.id)
        stored_character = session.get(Character, character.id)
        assert stored_project is not None
        assert stored_project.name == "Solar Echo"
        assert stored_character is not None and stored_character.name == "Aoi Kazumi"

        stored_project.status = "Storyboard"
        session.commit()
        assert session.get(Project, project.id).status == "Storyboard"

        session.delete(stored_character)
        session.commit()
        assert session.get(Character, character.id) is None
    finally:
        session.close()


def test_scene_shot_relationship_integrity(isolated_db):
    session = isolated_db["SessionLocal"]()
    try:
        project = Project(
            name="Skyline Requiem",
            description="A floating city reclamation arc",
            status="Storyboarding",
            genre="Sci-Fi",
        )
        session.add(project)
        session.commit()
        session.refresh(project)

        scene = Scene(project_id=project.id, name="Skybridge chase", description="A high-speed rooftop pursuit")
        session.add(scene)
        session.commit()
        session.refresh(scene)

        shot = Shot(scene_id=scene.id, title="Opening angle", description="A wide tracking shot", ordering=1)
        session.add(shot)
        session.commit()
        session.refresh(shot)

        assert shot in scene.shots
        assert shot.scene_id == scene.id
        assert scene.project_id == project.id
    finally:
        session.close()


def test_each_test_has_an_independent_database(tmp_path):
    engine_a = create_engine(f"sqlite:///{tmp_path / 'alpha.db'}", connect_args={"check_same_thread": False})
    engine_b = create_engine(f"sqlite:///{tmp_path / 'beta.db'}", connect_args={"check_same_thread": False})

    try:
        Base.metadata.create_all(bind=engine_a)
        Base.metadata.create_all(bind=engine_b)

        session_a = sessionmaker(bind=engine_a)()
        session_b = sessionmaker(bind=engine_b)()
        try:
            project_a = Project(name="Alpha", description="A", status="Concept", genre="Fantasy")
            session_a.add(project_a)
            session_a.commit()

            assert session_a.query(Project).count() == 1
            assert session_b.query(Project).count() == 0
        finally:
            session_a.close()
            session_b.close()
    finally:
        engine_a.dispose()
        engine_b.dispose()


def test_schema_creation_and_missing_tables_are_not_present(isolated_db):
    inspector = inspect(isolated_db["engine"])
    expected_tables = {
        "users",
        "projects",
        "stories",
        "characters",
        "scenes",
        "shots",
        "assets",
        "generation_jobs",
        "render_jobs",
    }
    assert expected_tables.issubset(Base.metadata.tables)
    assert all(inspector.has_table(table) for table in expected_tables)


def test_database_url_uses_pymysql_for_mysql(monkeypatch):
    from app.database.config import get_database_url

    monkeypatch.setenv("DATABASE_URL", "mysql://user:secret@db.example:3306/animeforge_db")
    url = get_database_url()

    assert url.startswith("mysql+pymysql://")
    assert "animeforge_db" in url


def test_user_email_index_is_unique_and_no_duplicate_index_errors(isolated_db):
    session = isolated_db["SessionLocal"]()
    try:
        user = User(email="pilot@animeforge.ai", name="Pilot", password_hash="hash")
        session.add(user)
        session.commit()

        duplicate = User(email="pilot@animeforge.ai", name="Duplicate", password_hash="hash")
        session.add(duplicate)
        with pytest.raises(IntegrityError):
            session.commit()
        session.rollback()
    finally:
        session.close()


def test_production_database_configuration_is_not_modified(monkeypatch, tmp_path):
    from app.database import session as session_module

    original_url = session_module.DATABASE_URL
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'should_not_change.db'}")

    assert session_module.DATABASE_URL == original_url
    assert original_url.startswith("sqlite") or original_url.startswith("mysql")
