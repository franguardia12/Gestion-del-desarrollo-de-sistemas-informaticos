from __future__ import annotations

import sys

from sqlalchemy import text

from database import engine


def _log(message: str) -> None:
    sys.stdout.write(f"{message}\n")


def upgrade() -> None:
    _log("Starting migration 0006_add_challenge_tracking...")
    _log("This migration creates the UserChallenge model and refactors UserReward")

    with engine.begin() as connection:
        # ========================================================================
        # STEP 1: Create new user_challenges table
        # ========================================================================
        _log("Step 1: Creating user_challenges table...")
        connection.execute(text("""
            CREATE TABLE IF NOT EXISTS user_challenges (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
                current_progress INTEGER NOT NULL DEFAULT 0,
                is_completed BOOLEAN NOT NULL DEFAULT FALSE,
                completed_at TIMESTAMP WITH TIME ZONE,
                CONSTRAINT uq_user_challenge UNIQUE (user_id, challenge_id)
            )
        """))
        _log("✓ user_challenges table created")

        # ========================================================================
        # STEP 2: Migrate existing data from user_rewards to user_challenges
        # ========================================================================
        _log("Step 2: Migrating challenge progress data...")

        # Check if old columns exist before migrating
        check_columns = connection.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'user_rewards'
            AND column_name IN ('current_progress', 'is_claimable')
        """)).fetchall()

        existing_columns = {row[0] for row in check_columns}
        has_current_progress = "current_progress" in existing_columns
        has_is_claimable = "is_claimable" in existing_columns
        has_old_columns = has_current_progress or has_is_claimable

        if has_old_columns:
            found_columns = []
            if has_current_progress:
                found_columns.append("current_progress")
            if has_is_claimable:
                found_columns.append("is_claimable")
            _log(f"  Found legacy columns ({', '.join(found_columns)}) - migrating data...")

            progress_expr = "COALESCE(ur.current_progress, 0)" if has_current_progress else "0"
            is_completed_expr = "COALESCE(ur.is_claimable, FALSE)" if has_is_claimable else "FALSE"
            completed_at_expr = (
                "CASE WHEN ur.is_claimable = TRUE THEN NOW() ELSE NULL END"
                if has_is_claimable
                else "NULL"
            )

            connection.execute(text(f"""
                INSERT INTO user_challenges (user_id, challenge_id, current_progress, is_completed, completed_at)
                SELECT
                    ur.user_id,
                    r.challenge_id,
                    {progress_expr} as current_progress,
                    {is_completed_expr} as is_completed,
                    {completed_at_expr} as completed_at
                FROM user_rewards ur
                INNER JOIN rewards r ON ur.reward_id = r.id
                WHERE r.challenge_id IS NOT NULL
                ON CONFLICT (user_id, challenge_id) DO NOTHING
            """))
            _log("  ✓ Data migrated from user_rewards to user_challenges")
        else:
            _log("  No old columns found - skipping data migration")

        # ========================================================================
        # STEP 3: Clean user_rewards table - keep only claimed rewards
        # ========================================================================
        _log("Step 3: Cleaning user_rewards table...")

        if has_is_claimable:
            _log("  Removing unclaimed rewards (is_claimable=FALSE AND is_used=FALSE)...")
            connection.execute(text("""
                DELETE FROM user_rewards
                WHERE is_claimable = FALSE AND is_used = FALSE
            """))
            _log("  ✓ Unclaimed rewards removed")
        else:
            _log("  Skipping cleanup - is_claimable column already removed")

        # ========================================================================
        # STEP 4: Add new timestamp columns to user_rewards
        # ========================================================================
        _log("Step 4: Adding timestamp columns to user_rewards...")

        connection.execute(text("""
            ALTER TABLE user_rewards
            ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
        """))

        connection.execute(text("""
            ALTER TABLE user_rewards
            ADD COLUMN IF NOT EXISTS used_at TIMESTAMP WITH TIME ZONE
        """))
        _log("  ✓ Timestamp columns added (claimed_at, used_at)")

        # ========================================================================
        # STEP 5: Set used_at for already used rewards
        # ========================================================================
        _log("Step 5: Setting used_at timestamps...")
        connection.execute(text("""
            UPDATE user_rewards
            SET used_at = NOW()
            WHERE is_used = TRUE AND used_at IS NULL
        """))
        _log("  ✓ used_at timestamps set for used rewards")

        # ========================================================================
        # STEP 6: Drop old columns from user_rewards
        # ========================================================================
        _log("Step 6: Removing old columns from user_rewards...")

        if has_current_progress:
            connection.execute(text("""
                ALTER TABLE user_rewards
                DROP COLUMN IF EXISTS current_progress
            """))

        if has_is_claimable:
            connection.execute(text("""
                ALTER TABLE user_rewards
                DROP COLUMN IF EXISTS is_claimable
            """))

        if has_old_columns:
            _log("  ✓ Old columns removed (current_progress, is_claimable)")
        else:
            _log("  Old columns already removed - skipping")

    _log("="*60)
    _log("Migration completed successfully!")
    _log("="*60)
    _log("")
    _log("Summary:")
    _log("  • Created user_challenges table for tracking challenge progress")
    _log("  • Migrated existing progress data from user_rewards")
    _log("  • Cleaned user_rewards to only contain claimed rewards")
    _log("  • Added claimed_at and used_at timestamp columns")
    _log("  • Removed current_progress and is_claimable columns")


if __name__ == "__main__":
    try:
        upgrade()
    except Exception as exc:
        sys.stderr.write(f"\n❌ Migration failed: {exc}\n")
        sys.exit(1)
