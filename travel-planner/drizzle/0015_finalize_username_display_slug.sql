-- Migration 0015 neutralized: finalization of username_display/username_slug is deprecated.
-- This file is intentionally neutralized to avoid making schema changes related
-- to slug fields (`username_slug`, `current_slug`, `profile_slugs`).

SELECT 'drizzle/0015_finalize_username_display_slug.sql is neutralized and will not run' AS info;
