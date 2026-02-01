from __future__ import annotations

import sys

from sqlalchemy import text

from database import engine


def _log(message: str) -> None:
    sys.stdout.write(f"{message}\n")


def upgrade() -> None:
    _log("Starting migration 0007_add_reward_types...")
    _log("This migration adds reward_type, badge_icon, and badge_display_name fields to rewards table")

    with engine.begin() as connection:
        # ========================================================================
        # STEP 1: Add reward_type column
        # ========================================================================
        _log("Step 1: Adding reward_type column...")
        connection.execute(text("""
            ALTER TABLE rewards
            ADD COLUMN IF NOT EXISTS reward_type VARCHAR(20) NOT NULL DEFAULT 'discount'
        """))
        _log("✓ reward_type column added")

        # ========================================================================
        # STEP 2: Add badge_icon column
        # ========================================================================
        _log("Step 2: Adding badge_icon column...")
        connection.execute(text("""
            ALTER TABLE rewards
            ADD COLUMN IF NOT EXISTS badge_icon VARCHAR(50)
        """))
        _log("✓ badge_icon column added")

        # ========================================================================
        # STEP 3: Add badge_display_name column
        # ========================================================================
        _log("Step 3: Adding badge_display_name column...")
        connection.execute(text("""
            ALTER TABLE rewards
            ADD COLUMN IF NOT EXISTS badge_display_name VARCHAR(50)
        """))
        _log("✓ badge_display_name column added")

    _log("="*60)
    _log("Migration completed successfully!")
    _log("="*60)
    _log("")
    _log("Summary:")
    _log("  • Added reward_type column (default: 'discount')")
    _log("  • Added badge_icon column for badge rewards")
    _log("  • Added badge_display_name column for badge rewards")
    _log("")
    _log("Next steps:")
    _log("  • Run insert_initial_rewards.py to update existing rewards with types")


if __name__ == "__main__":
    try:
        upgrade()
    except Exception as exc:
        sys.stderr.write(f"\n❌ Migration failed: {exc}\n")
        sys.exit(1)
