from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv


def _load_env() -> None:
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        load_dotenv(env_path)
    else:
        load_dotenv()


@lru_cache()
def get_settings() -> "Settings":
    _load_env()
    allow_openai_localhost = _get_allow_openai_localhost()
    raw_openai_base_url = os.getenv("OPENAI_BASE_URL", "")
    return Settings(
        database_url=os.getenv(
            "DATABASE_URL",
            "postgresql+psycopg://postgres:postgres@localhost:5434/viajerosxp",
        ),
        mongodb_uri=os.getenv("MONGODB_URI", "mongodb://localhost:27017"),
        mongodb_database=os.getenv("MONGODB_DATABASE", "viajerosxp"),
        mongodb_avatars_bucket=os.getenv("MONGODB_AVATARS_BUCKET", "user_avatars"),
        mongodb_place_photos_bucket=os.getenv("MONGODB_PLACE_PHOTOS_BUCKET", "place_photos"),
        mongodb_review_photos_bucket=os.getenv("MONGODB_REVIEW_PHOTOS_BUCKET", "review_photos"),
        frontend_origin=os.getenv("FRONTEND_ORIGIN", "http://localhost:5173"),
        jwt_secret_key=os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production"),
        jwt_algorithm=os.getenv("JWT_ALGORITHM", "HS256"),
        access_token_expire_minutes=int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60")),
        # NUEVO: Agregar LocationIQ
        locationiq_api_key=os.getenv("LOCATIONIQ_API_KEY", ""),
        uploads_root=Path(
            os.getenv(
                "UPLOADS_ROOT",
                Path(__file__).resolve().parent / "uploads",
            )
        ),
        openai_api_key=os.getenv("OPENAI_API_KEY", ""),
        openai_model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        openai_base_url=_normalize_openai_base_url(raw_openai_base_url, allow_openai_localhost),
        # Configuración SMTP para notificaciones por correo
        smtp_host=os.getenv("SMTP_HOST", ""),
        smtp_port=int(os.getenv("SMTP_PORT", "587")),
        smtp_username=os.getenv("SMTP_USERNAME", ""),
        smtp_password=os.getenv("SMTP_PASSWORD", ""),
        smtp_from_email=os.getenv("SMTP_FROM_EMAIL", ""),
        smtp_use_tls=os.getenv(
            "SMTP_USE_TLS", "true"
        ).lower() in ("true", "1", "yes"),
    )


def _get_bool_env(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in ("true", "1", "yes", "on")


def _get_allow_openai_localhost() -> bool:
    """
    By default we allow localhost endpoints only outside containers.
    In containers a loopback URL would point to the API container itself, not the host,
    so we disable it unless explicitly requested.
    """
    running_in_container = Path("/.dockerenv").exists()
    return _get_bool_env("OPENAI_ALLOW_LOCALHOST", default=not running_in_container)


def _normalize_openai_base_url(value: str, allow_localhost: bool) -> str | None:
    url = value.strip()
    if not url:
        return None
    parsed = urlparse(url)
    if parsed.hostname in {"127.0.0.1", "localhost"} and not allow_localhost:
        return None
    return url


class Settings:
    def __init__(
        self,
        database_url: str,
        mongodb_uri: str,
        mongodb_database: str,
        mongodb_avatars_bucket: str,
        mongodb_place_photos_bucket: str,
        mongodb_review_photos_bucket: str,
        frontend_origin: str,
        jwt_secret_key: str,
        jwt_algorithm: str,
        access_token_expire_minutes: int,
        locationiq_api_key: str,  # NUEVO
        uploads_root: Path,
        openai_api_key: str,
        openai_model: str,
        openai_base_url: str | None,
        smtp_host: str,
        smtp_port: int,
        smtp_username: str,
        smtp_password: str,
        smtp_from_email: str,
        smtp_use_tls: bool,
    ) -> None:
        self.database_url = database_url
        self.mongodb_uri = mongodb_uri
        self.mongodb_database = mongodb_database
        self.mongodb_avatars_bucket = mongodb_avatars_bucket
        self.mongodb_place_photos_bucket = mongodb_place_photos_bucket
        self.mongodb_review_photos_bucket = mongodb_review_photos_bucket
        self.frontend_origin = frontend_origin
        self.jwt_secret_key = jwt_secret_key
        self.jwt_algorithm = jwt_algorithm
        self.access_token_expire_minutes = access_token_expire_minutes
        self.locationiq_api_key = locationiq_api_key  # NUEVO
        self.uploads_root = uploads_root.expanduser().resolve()
        self.openai_api_key = openai_api_key
        self.openai_model = openai_model
        self.openai_base_url = openai_base_url
        self.smtp_host = smtp_host
        self.smtp_port = smtp_port
        self.smtp_username = smtp_username
        self.smtp_password = smtp_password
        self.smtp_from_email = smtp_from_email
        self.smtp_use_tls = smtp_use_tls
