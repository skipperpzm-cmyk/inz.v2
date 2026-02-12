-- Migration 0015 (populate_missing_profiles) neutralized: slug/backfill flow deprecated.
-- This file is intentionally neutralized to avoid automated backfills that rely
-- on `username_slug`, `current_slug`, or `profile_slugs` columns.

SELECT 'drizzle/0015_populate_missing_profiles.sql is neutralized and will not run' AS info;
