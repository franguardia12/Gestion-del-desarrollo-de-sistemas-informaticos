from __future__ import annotations

import sys

from sqlalchemy import text

from database import engine


def _log(message: str) -> None:
    sys.stdout.write(f"{message}\n")


def upgrade() -> None:
    _log("Starting migration 0001_add_review_author_fk...")

    with engine.begin() as connection:
        _log("Adding column user_id to reviews table (if missing)...")
        connection.execute(
            text("ALTER TABLE reviews ADD COLUMN IF NOT EXISTS user_id INTEGER")
        )

        _log("Adding column title to reviews table (if missing)...")
        connection.execute(
            text("ALTER TABLE reviews ADD COLUMN IF NOT EXISTS title VARCHAR(255)")
        )

        _log("Attempting to link existing reviews with users (matching username/full_name)...")
        connection.execute(
            text(
                """
                UPDATE reviews AS r
                SET user_id = u.id
                FROM users AS u
                WHERE r.user_id IS NULL
                  AND (
                        lower(r.author_name) = lower(u.username)
                     OR lower(r.author_name) = lower(u.full_name)
                  )
                """
            )
        )

        remaining = connection.execute(
            text("SELECT COUNT(*) FROM reviews WHERE user_id IS NULL")
        ).scalar_one()

        if remaining:
            raise RuntimeError(
                f"Migration aborted: {remaining} review(s) still have no matching user. "
                "Update those rows manually so they reference a valid user (user_id) "
                "and then rerun this migration."
            )

        _log("Adding foreign key constraint and NOT NULL requirement...")
        constraint_exists = connection.execute(
            text(
                """
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'reviews_user_id_fkey'
                """
            )
        ).scalar()

        if not constraint_exists:
            connection.execute(
                text(
                    """
                    ALTER TABLE reviews
                    ADD CONSTRAINT reviews_user_id_fkey
                    FOREIGN KEY (user_id) REFERENCES users(id)
                    ON DELETE CASCADE
                    """
                )
            )
        connection.execute(
            text("ALTER TABLE reviews ALTER COLUMN user_id SET NOT NULL")
        )

        _log("Creating index reviews_user_id_idx (if missing)...")
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS reviews_user_id_idx ON reviews(user_id)"
            )
        )

    _log("Migration completed successfully.")


if __name__ == "__main__":
    try:
        upgrade()
    except Exception as exc:
        sys.stderr.write(f"Migration failed: {exc}\n")
        sys.exit(1)
