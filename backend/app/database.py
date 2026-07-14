from collections.abc import Generator
import json

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
_engine_kwargs: dict = {"connect_args": connect_args}
if settings.database_url.endswith(":memory:") or settings.database_url == "sqlite://":
    _engine_kwargs["poolclass"] = StaticPool
elif not settings.database_url.startswith("sqlite"):
    _engine_kwargs["pool_pre_ping"] = True
    _engine_kwargs["pool_recycle"] = 280
    _engine_kwargs["pool_size"] = 2
    _engine_kwargs["max_overflow"] = 3
engine = create_engine(settings.database_url, **_engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def _ensure_migrations_table() -> None:
    from sqlalchemy import text
    with engine.connect() as conn:
        conn.execute(text(
            "CREATE TABLE IF NOT EXISTS schema_migrations "
            "(name VARCHAR(100) PRIMARY KEY, "
            "applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"
        ))
        conn.commit()


def _migration_done(name: str) -> bool:
    from sqlalchemy import text
    with engine.connect() as conn:
        return conn.execute(
            text("SELECT 1 FROM schema_migrations WHERE name = :n"), {"n": name}
        ).fetchone() is not None


def _mark_done(name: str) -> None:
    from sqlalchemy import text
    with engine.connect() as conn:
        if settings.database_url.startswith("sqlite"):
            conn.execute(text("INSERT OR IGNORE INTO schema_migrations (name) VALUES (:n)"), {"n": name})
        else:
            conn.execute(text("INSERT INTO schema_migrations (name) VALUES (:n) ON CONFLICT DO NOTHING"), {"n": name})
        conn.commit()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _sqlite_column_names(conn, table: str) -> set[str]:
    rows = conn.exec_driver_sql(f"PRAGMA table_info({table})").fetchall()
    return {row[1] for row in rows}


def _migrate_sqlite_cortex_user_id() -> None:
    if not settings.database_url.startswith("sqlite"):
        return
    from sqlalchemy import inspect

    with engine.begin() as conn:
        tables = inspect(conn).get_table_names()
        if "users" not in tables:
            return
        cols = _sqlite_column_names(conn, "users")
        if "cortex_user_id" not in cols:
            conn.exec_driver_sql("ALTER TABLE users ADD COLUMN cortex_user_id INTEGER")
            conn.exec_driver_sql(
                "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_cortex_user_id "
                "ON users (cortex_user_id)"
            )


def _migrate_sqlite_interaction_duration() -> None:
    if not settings.database_url.startswith("sqlite"):
        return
    from sqlalchemy import inspect

    with engine.begin() as conn:
        tables = inspect(conn).get_table_names()
        if "interactions" not in tables:
            return
        if "duration_minutes" not in _sqlite_column_names(conn, "interactions"):
            conn.exec_driver_sql("ALTER TABLE interactions ADD COLUMN duration_minutes INTEGER")


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

        if "interactions" in tables:
            ix_cols = _sqlite_column_names(conn, "interactions")
            if "energy" not in ix_cols:
                conn.exec_driver_sql("ALTER TABLE interactions ADD COLUMN energy REAL")
            if "duration_minutes" not in ix_cols:
                conn.exec_driver_sql("ALTER TABLE interactions ADD COLUMN duration_minutes INTEGER")
            if "reflection_json" not in ix_cols:
                conn.exec_driver_sql("ALTER TABLE interactions ADD COLUMN reflection_json TEXT")
            if "kind" not in ix_cols:
                conn.exec_driver_sql("ALTER TABLE interactions ADD COLUMN kind VARCHAR(20)")


def _migrate_postgres() -> None:
    if not settings.database_url.startswith(("postgresql", "postgres")):
        return
    from sqlalchemy import inspect, text

    with engine.begin() as conn:
        inspector = inspect(conn)
        tables = inspector.get_table_names()
        if "users" not in tables:
            return

        existing_users = {c["name"] for c in inspector.get_columns("users")}
        if "cortex_user_id" not in existing_users:
            conn.execute(text("ALTER TABLE users ADD COLUMN cortex_user_id INTEGER"))
            conn.execute(text(
                "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_cortex_user_id "
                "ON users (cortex_user_id)"
            ))

        if "interactions" in tables:
            existing_ix = {c["name"] for c in inspector.get_columns("interactions")}
            if "energy" not in existing_ix:
                conn.execute(text("ALTER TABLE interactions ADD COLUMN energy FLOAT"))
            if "duration_minutes" not in existing_ix:
                conn.execute(text("ALTER TABLE interactions ADD COLUMN duration_minutes INTEGER"))
            if "reflection_json" not in existing_ix:
                conn.execute(text("ALTER TABLE interactions ADD COLUMN reflection_json TEXT"))
            if "kind" not in existing_ix:
                conn.execute(text("ALTER TABLE interactions ADD COLUMN kind VARCHAR(20)"))

        # WebAuthn
        if "webauthn_credentials" not in tables:
            conn.execute(text(
                "CREATE TABLE webauthn_credentials ("
                "credential_id TEXT PRIMARY KEY, "
                "public_key TEXT NOT NULL, "
                "sign_count INTEGER DEFAULT 0, "
                "user_id TEXT NOT NULL, "
                "created_at TIMESTAMP DEFAULT NOW())"
            ))
            conn.execute(text("CREATE INDEX ix_webauthn_cred_user ON webauthn_credentials (user_id)"))
        if "webauthn_challenges" not in tables:
            conn.execute(text(
                "CREATE TABLE webauthn_challenges ("
                "id VARCHAR(64) PRIMARY KEY, "
                "challenge VARCHAR(128) NOT NULL, "
                "user_id TEXT, "
                "expires_at TIMESTAMP NOT NULL, "
                "created_at TIMESTAMP DEFAULT NOW())"
            ))


def _migrate_postgres_interaction_duration() -> None:
    if not settings.database_url.startswith(("postgresql", "postgres")):
        return
    from sqlalchemy import inspect, text

    with engine.begin() as conn:
        inspector = inspect(conn)
        tables = inspector.get_table_names()
        if "interactions" not in tables:
            return
        existing_ix = {c["name"] for c in inspector.get_columns("interactions")}
        if "duration_minutes" not in existing_ix:
            conn.execute(text("ALTER TABLE interactions ADD COLUMN duration_minutes INTEGER"))


def _migrate_push_subscriptions() -> None:
    from sqlalchemy import inspect, text

    with engine.begin() as conn:
        inspector = inspect(conn)
        if "push_subscriptions" in inspector.get_table_names():
            return
        if settings.database_url.startswith("sqlite"):
            conn.execute(text(
                "CREATE TABLE IF NOT EXISTS push_subscriptions ("
                "id INTEGER PRIMARY KEY AUTOINCREMENT, "
                "user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, "
                "endpoint TEXT NOT NULL, "
                "p256dh TEXT NOT NULL, "
                "auth TEXT NOT NULL, "
                "device_name VARCHAR(120), "
                "platform VARCHAR(80), "
                "enabled BOOLEAN DEFAULT 1, "
                "created_at DATETIME DEFAULT CURRENT_TIMESTAMP, "
                "updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, "
                "UNIQUE(user_id, endpoint))"
            ))
        else:
            conn.execute(text(
                "CREATE TABLE IF NOT EXISTS push_subscriptions ("
                "id SERIAL PRIMARY KEY, "
                "user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, "
                "endpoint TEXT NOT NULL, "
                "p256dh TEXT NOT NULL, "
                "auth TEXT NOT NULL, "
                "device_name VARCHAR(120), "
                "platform VARCHAR(80), "
                "enabled BOOLEAN DEFAULT TRUE, "
                "created_at TIMESTAMP DEFAULT NOW(), "
                "updated_at TIMESTAMP DEFAULT NOW(), "
                "UNIQUE(user_id, endpoint))"
            ))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_push_subscriptions_user ON push_subscriptions (user_id)"))


def _migrate_single_diary_reminder_settings() -> None:
    from sqlalchemy import inspect, text

    with engine.begin() as conn:
        inspector = inspect(conn)
        if "settings" not in inspector.get_table_names():
            return
        rows = conn.execute(
            text(
                "SELECT key, value FROM settings "
                "WHERE key = :plain_key OR key LIKE :namespaced_key"
            ),
            {
                "plain_key": "notification_reminders",
                "namespaced_key": "%:notification_reminders",
            },
        ).mappings().all()
        for row in rows:
            try:
                loaded = json.loads(row["value"])
            except (TypeError, json.JSONDecodeError):
                continue
            cleaned = {
                "enabled": bool(loaded.get("enabled", False)),
                "time": "21:30",
            }
            conn.execute(
                text("UPDATE settings SET value = :value WHERE key = :key"),
                {"key": row["key"], "value": json.dumps(cleaned)},
            )


def init_db() -> None:
    from pathlib import Path

    from app import models  # noqa: F401

    if settings.database_url.startswith("sqlite"):
        db_path = Path(settings.database_url.replace("sqlite:///", ""))
        db_path.parent.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    _ensure_migrations_table()
    for name, fn in [
        ("sqlite_schema", _migrate_sqlite),
        ("postgres_schema", _migrate_postgres),
        ("sqlite_cortex_user_id", _migrate_sqlite_cortex_user_id),
        ("sqlite_interaction_duration", _migrate_sqlite_interaction_duration),
        ("postgres_interaction_duration", _migrate_postgres_interaction_duration),
        ("push_subscriptions", _migrate_push_subscriptions),
        ("single_diary_reminder_settings", _migrate_single_diary_reminder_settings),
        ("fixed_diary_reminder_time", _migrate_single_diary_reminder_settings),
    ]:
        if not _migration_done(name):
            fn()
            _mark_done(name)


if __name__ == "__main__":
    init_db()
    print("Database schema is ready.")
