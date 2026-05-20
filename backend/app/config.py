from __future__ import annotations

from pathlib import Path
from typing import Union

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_db_path = (Path(__file__).resolve().parents[2] / "data" / "canopy.db").as_posix()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    database_url: str = f"sqlite:///{_db_path}"
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://sameeradsv.github.io",
    ]
    auth_required: bool = False

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_cors_origins(cls, value: Union[str, list]) -> list:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value


settings = Settings()
