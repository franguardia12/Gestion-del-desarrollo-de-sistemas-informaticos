from __future__ import annotations

import sys

from sqlalchemy import text

from database import engine


def _log(message: str) -> None:
    sys.stdout.write(f"{message}\n")


def upgrade() -> None:
    _log("Starting migration 0005_add_review_reply_fields...")

    with engine.begin() as connection:
        _log("Adding column reply_text to reviews table (if missing)...")
        connection.execute(
            text("ALTER TABLE reviews ADD COLUMN IF NOT EXISTS reply_text TEXT")
        )

        _log("Adding column reply_created_at to reviews table (if missing)...")
        connection.execute(
            text("ALTER TABLE reviews ADD COLUMN IF NOT EXISTS reply_created_at TIMESTAMP WITH TIME ZONE")
        )

        _log("Adding column reply_updated_at to reviews table (if missing)...")
        connection.execute(
            text("ALTER TABLE reviews ADD COLUMN IF NOT EXISTS reply_updated_at TIMESTAMP WITH TIME ZONE")
        )

    _log("Migration completed successfully.")


if __name__ == "__main__":
    try:
        upgrade()
    except Exception as exc:
        sys.stderr.write(f"Migration failed: {exc}\n")
        sys.exit(1)
