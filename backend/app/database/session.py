from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database.config import get_database_url

DATABASE_URL = get_database_url()
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def build_session_factory(database_url: str | None = None):
    url = database_url or get_database_url()
    engine_kwargs = {"pool_pre_ping": True}
    if url.startswith("sqlite"):
        engine_kwargs["connect_args"] = {"check_same_thread": False}
    engine_for_url = create_engine(url, **engine_kwargs)
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=engine_for_url)
    return engine_for_url, session_factory
