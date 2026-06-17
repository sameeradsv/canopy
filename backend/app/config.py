from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_db_path = (Path(__file__).resolve().parents[2] / "data" / "canopy.db").as_posix()

_default_cors = "https://sameeradsv.github.io"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    database_url: str = f"sqlite:///{_db_path}"
    cors_origins: str = _default_cors
    auth_required: bool = False
    # Optional: URL of the shared Cortex Auth Server, e.g. "http://localhost:7000"
    cortex_auth_url: str = ""
    # Optional: Groq API key for AI classification
    groq_api_key: str = ""

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
