from pathlib import Path

from pydantic_settings import BaseSettings


_db_path = (Path(__file__).resolve().parents[2] / "data" / "canopy.db").as_posix()


class Settings(BaseSettings):
    database_url: str = f"sqlite:///{_db_path}"
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    auth_required: bool = False

    class Config:
        env_file = ".env"


settings = Settings()
