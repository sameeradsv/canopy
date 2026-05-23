from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
_engine_kwargs: dict = {"connect_args": connect_args}
if settings.database_url.endswith(":memory:") or settings.database_url == "sqlite://":
    _engine_kwargs["poolclass"] = StaticPool
engine = create_engine(settings.database_url, **_engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _sqlite_column_names(conn, table: str) -> set[str]:
    rows = conn.exec_driver_sql(f"PRAGMA table_info({table})").fetchall()
    return {row[1] for row in rows}


def _migrate_sqlite() -> None:
    if not settings.database_url.startswith("sqlite"):
        return
    from sqlalchemy import inspect

    with engine.begin() as conn:
        tables = inspect(conn).get_table_names()
        if "people" not in tables:
            return

        cols = _sqlite_column_names(conn, "people")
        if "relationship" not in cols:
            conn.exec_driver_sql("ALTER TABLE people ADD COLUMN relationship VARCHAR(40)")

        for table in ("people", "interactions"):
            if table in tables:
                if "user_id" not in _sqlite_column_names(conn, table):
                    conn.exec_driver_sql(
                        f"ALTER TABLE {table} ADD COLUMN user_id INTEGER REFERENCES users(id)"
                    )


def init_db() -> None:
    from pathlib import Path

    from app import models  # noqa: F401

    if settings.database_url.startswith("sqlite"):
        db_path = Path(settings.database_url.replace("sqlite:///", ""))
        db_path.parent.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    _migrate_sqlite()
