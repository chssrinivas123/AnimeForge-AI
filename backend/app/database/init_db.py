import logging

from sqlalchemy.exc import SQLAlchemyError

from app import models
from app.database.base import Base
from app.database.session import engine

logger = logging.getLogger(__name__)
REQUIRED_TABLES = {
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
REQUIRED_MODELS = {
    "Asset",
    "Character",
    "GenerationJob",
    "Project",
    "RenderJob",
    "Scene",
    "Shot",
    "Story",
    "User",
}


def init_db() -> None:
    missing_models = REQUIRED_MODELS.difference(models.__all__)
    if missing_models:
        raise RuntimeError(f"ORM models are not exported: {', '.join(sorted(missing_models))}")

    missing_tables = REQUIRED_TABLES.difference(Base.metadata.tables)
    if missing_tables:
        raise RuntimeError(f"ORM models are not registered: {', '.join(sorted(missing_tables))}")

    try:
        Base.metadata.create_all(bind=engine)
    except SQLAlchemyError:
        logger.exception("Database initialization failed.")
        raise
