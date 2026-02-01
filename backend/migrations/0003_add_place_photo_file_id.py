from __future__ import annotations

import sys

from sqlalchemy import text

from database import engine


def _log(message: str) -> None:
    sys.stdout.write(f"{message}\n")


def upgrade() -> None:
    _log("Starting migration 0003_add_place_photo_file_id...")

    with engine.begin() as connection:
        _log("Adding column photo_file_id to place_photos table (if missing)...")
        connection.execute(
            text("ALTER TABLE place_photos ADD COLUMN IF NOT EXISTS photo_file_id VARCHAR(96)")
        )

    _log("Migration completed successfully.")


if __name__ == "__main__":
    try:
        upgrade()
    except Exception as exc:
        sys.stderr.write(f"Migration failed: {exc}\n")
        sys.exit(1)
