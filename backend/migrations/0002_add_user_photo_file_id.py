from __future__ import annotations

import sys

from sqlalchemy import text

from constants import DEFAULT_AVATAR_URL
from database import engine


def _log(message: str) -> None:
    sys.stdout.write(f"{message}\n")


def upgrade() -> None:
    _log("Starting migration 0002_add_user_photo_file_id...")

    with engine.begin() as connection:
        _log("Adding column photo_file_id to users table (if missing)...")
        connection.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_file_id VARCHAR(96)")
        )

        _log("Resetting legacy local avatar URLs to default avatar (if applicable)...")
        connection.execute(
            text(
                """
                UPDATE users
                SET photo_url = :default_avatar
                WHERE photo_file_id IS NULL
                  AND photo_url LIKE '%/uploads/avatars/%'
                """
            ),
            {"default_avatar": DEFAULT_AVATAR_URL},
        )

    _log("Migration completed successfully.")


if __name__ == "__main__":
    try:
        upgrade()
    except Exception as exc:
        sys.stderr.write(f"Migration failed: {exc}\n")
        sys.exit(1)
