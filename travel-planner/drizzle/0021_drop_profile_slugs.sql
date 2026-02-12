-- Migration: 0021_drop_profile_slugs.sql
-- Purpose: Safely remove legacy profile slug artifacts from the database.
-- Actions performed (best-effort, non-destructive where possible):
--  1) Archive `public.profile_slugs` into `public.profile_slugs_archive` (if present)
--     so historical data is preserved for audit before removal.
--  2) Drop any indexes whose definitions reference `profile_slugs` or `current_slug`.
--  3) Drop the `public.profile_slugs` table.
--     - First attempt a plain DROP; if that fails due to dependencies, attempt
--       DROP ... CASCADE with a NOTICE so DBAs are aware.
--  4) Drop the `current_slug` column from `public.profiles` if it exists.

-- Safety notes:
--  - This migration is intentionally explicit about archival and uses IF EXISTS
--    checks to avoid failing on databases where slug artifacts were already removed.
--  - Review `public.profile_slugs_archive` contents after running; you may want
--    to move it to long-term storage outside the primary DB before dropping it.
--  - If you require a logical backup (SQL dump) instead of an in-DB archive,
--    perform that dump before running this migration.

BEGIN;

-- 1) Archive profile_slugs if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profile_slugs'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profile_slugs_archive'
    ) THEN
      RAISE NOTICE 'Archiving public.profile_slugs -> public.profile_slugs_archive';
      EXECUTE 'CREATE TABLE public.profile_slugs_archive AS TABLE public.profile_slugs';
    ELSE
      RAISE NOTICE 'Archive table public.profile_slugs_archive already exists; skipping archive step';
    END IF;
  ELSE
    RAISE NOTICE 'No public.profile_slugs table found; skipping archive step';
  END IF;
END$$;

-- 2) Drop indexes that reference profile_slugs or current_slug (best-effort)
DO $$
DECLARE
  idx RECORD;
BEGIN
  FOR idx IN
    SELECT schemaname, indexname, indexdef
    FROM pg_catalog.pg_indexes
    WHERE indexdef ILIKE '%profile_slugs%' OR indexdef ILIKE '%current_slug%'
  LOOP
    BEGIN
      RAISE NOTICE 'Dropping index %.% (definition=%)', idx.schemaname, idx.indexname, idx.indexdef;
      EXECUTE format('DROP INDEX IF EXISTS %I.%I', idx.schemaname, idx.indexname);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to drop index %.%: %', idx.schemaname, idx.indexname, SQLERRM;
    END;
  END LOOP;
END$$;

-- 3) Drop the profile_slugs table. Try plain DROP first, fall back to CASCADE if needed.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profile_slugs') THEN
    BEGIN
      EXECUTE 'DROP TABLE public.profile_slugs';
      RAISE NOTICE 'Dropped table public.profile_slugs';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to drop public.profile_slugs without CASCADE: %; attempting CASCADE', SQLERRM;
      BEGIN
        EXECUTE 'DROP TABLE public.profile_slugs CASCADE';
        RAISE NOTICE 'Dropped table public.profile_slugs CASCADE';
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Failed to drop public.profile_slugs even with CASCADE: %; manual intervention required', SQLERRM;
      END;
    END;
  ELSE
    RAISE NOTICE 'public.profile_slugs not present; skipping drop';
  END IF;
END$$;

-- 4) Drop column current_slug from public.profiles if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='current_slug'
  ) THEN
    BEGIN
      ALTER TABLE public.profiles DROP COLUMN IF EXISTS current_slug;
      RAISE NOTICE 'Dropped column public.profiles.current_slug';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to drop column public.profiles.current_slug: %; manual intervention may be required', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'Column public.profiles.current_slug not present; skipping';
  END IF;
END$$;

COMMIT;

-- Verification guidance (manual steps after running migration):
-- 1) Inspect `public.profile_slugs_archive` (if created) to confirm it contains expected historical rows.
--    SELECT count(*) FROM public.profile_slugs_archive;
-- 2) Confirm indexes referencing `profile_slugs` or `current_slug` are gone:
--    SELECT * FROM pg_catalog.pg_indexes WHERE indexdef ILIKE '%profile_slugs%' OR indexdef ILIKE '%current_slug%';
-- 3) Verify that `public.profiles` no longer has the `current_slug` column:
--    SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles';
-- 4) Run application build/tests and exercise `/profile/{id}` pages to ensure runtime behavior unaffected.
