import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy.engine import make_url

ENV_FILE = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(ENV_FILE, override=False, encoding="utf-8")


def get_database_url() -> str:
    env_database_url = os.getenv("DATABASE_URL") or os.getenv("MYSQL_DATABASE_URL")
    if env_database_url:
        url = make_url(env_database_url)
        if url.drivername.startswith("mysql"):
            url = url.set(drivername="mysql+pymysql")
        return url.render_as_string(hide_password=False)

    mysql_host = os.getenv("MYSQL_HOST")
    mysql_user = os.getenv("MYSQL_USER")
    mysql_db = os.getenv("MYSQL_DB")
    mysql_password = os.getenv("MYSQL_PASSWORD")
    mysql_port = os.getenv("MYSQL_PORT", "3306")

    if mysql_host and mysql_user and mysql_db:
        from sqlalchemy.engine import URL

        url = URL.create(
            "mysql+pymysql",
            username=mysql_user,
            password=mysql_password,
            host=mysql_host,
            port=int(mysql_port),
            database=mysql_db,
            query={"charset": "utf8mb4"},
        )
        return url.render_as_string(hide_password=False)

    return "sqlite:///./animeforge_dev.db"
