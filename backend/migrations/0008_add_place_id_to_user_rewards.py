from __future__ import annotations

import sys

from sqlalchemy import text

from database import engine


def _log(message: str) -> None:
    sys.stdout.write(f"{message}\n")


def upgrade() -> None:
    _log("Starting migration 0008_add_place_id_to_user_rewards...")
    _log("This migration adds place_id column to user_rewards table for place-specific badges")

    with engine.begin() as connection:
        # ========================================================================
        # STEP 1: Add place_id column (nullable for backwards compatibility)
        # ========================================================================
        _log("Step 1: Adding place_id column...")
        connection.execute(text("""
            ALTER TABLE user_rewards
            ADD COLUMN IF NOT EXISTS place_id INTEGER
        """))
        _log("[OK] place_id column added")

        # ========================================================================
        # STEP 2: Add foreign key constraint (only if it doesn't exist)
        # ========================================================================
        _log("Step 2: Checking if foreign key constraint exists...")
        result = connection.execute(text("""
            SELECT constraint_name
            FROM information_schema.table_constraints
            WHERE table_name = 'user_rewards'
            AND constraint_name = 'fk_user_rewards_place_id'
        """))
        
        if result.fetchone() is None:
            _log("Adding foreign key constraint to places table...")
            connection.execute(text("""
                ALTER TABLE user_rewards
                ADD CONSTRAINT fk_user_rewards_place_id
                FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE SET NULL
            """))
            _log("[OK] Foreign key constraint added")
        else:
            _log("[SKIP] Foreign key constraint already exists")

    _log("="*60)
    _log("Migration completed successfully!")
    _log("="*60)
    _log("")
    _log("Summary:")
    _log("  - Added place_id column to user_rewards (nullable)")
    _log("  - Added foreign key constraint to places table")
    _log("")
    _log("Next steps:")
    _log("  - Update claim_reward endpoint to accept place_id parameter")
    _log("  - Update get_place_badges to filter by specific place_id")


if __name__ == "__main__":
    try:
        upgrade()
    except Exception as exc:
        sys.stderr.write(f"\n❌ Migration failed: {exc}\n")
        sys.exit(1)
