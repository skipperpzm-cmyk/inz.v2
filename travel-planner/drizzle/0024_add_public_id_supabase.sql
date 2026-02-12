-- 0024_add_public_id_supabase.sql
-- Supabase-ready migration to add a short stable `public_id` to public.profiles.
-- Strategy (safe for live DB):
--  1) In a transaction: add the column (nullable) and backfill existing rows.
--  2) Commit, then create a UNIQUE INDEX CONCURRENTLY to avoid long exclusive locks.
--  3) In a final transaction: set the column NOT NULL and install a trigger/function
--     that generates unique 8-digit numeric `public_id` values for future inserts.
--
-- IMPORTANT: Run with a DB backup; step 2 uses CREATE INDEX CONCURRENTLY which
-- must be run outside of an explicit transaction block.

-- 1) Add column and backfill (transactional)
BEGIN;

-- Add the column if it does not exist (keep nullable for backfill)
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS public_id varchar(8);

-- Backfill existing rows that lack public_id.
-- This loop generates an 8-digit number (10000000..99999999) per row and retries
-- a limited number of times on collisions. It updates rows one-by-one to avoid
-- holding long table-wide locks.
DO $$
DECLARE
  r RECORD;
  new_id text;
  tries integer;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE public_id IS NULL LOOP
    tries := 0;
    LOOP
      -- generate an 8-digit number (leading digit non-zero)
      new_id := lpad(((floor(random()*90000000) + 10000000)::int)::text, 8, '0');

      -- ensure uniqueness in the latest table state
      IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE public_id = new_id) THEN
        UPDATE public.profiles SET public_id = new_id WHERE id = r.id;
        EXIT;
      END IF;

      tries := tries + 1;
      IF tries > 100 THEN
        RAISE EXCEPTION 'unable to generate unique public_id for profile % after % attempts', r.id, tries;
      END IF;
    END LOOP;
  END LOOP;
END$$;

COMMIT;

-- 2) Create unique index CONCURRENTLY to avoid long exclusive locks on large tables.
-- Note: CREATE INDEX CONCURRENTLY cannot run inside a transaction block.
-- If the index already exists, the following will fail in older PG versions; we try
-- to be defensive but recommend checking existence first in psql if needed.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'i' AND c.relname = 'profiles_public_id_idx') THEN
    PERFORM pg_sleep(0); -- noop to keep DO block; actual CREATE INDEX CONCURRENTLY runs after
  END IF;
END$$;

-- Attempt to create the index concurrently. This must be executed outside of a BEGIN/COMMIT.
-- When running via a migration runner that executes statements sequentially, the runner
-- should execute this statement on its own (not wrapped in a transaction).
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS profiles_public_id_idx ON public.profiles (public_id);

-- 3) Make column NOT NULL and install trigger function (transactional)
BEGIN;

-- Ensure no NULLs remain (sanity check)
DO $$
BEGIN
  IF (SELECT count(*) FROM public.profiles WHERE public_id IS NULL) > 0 THEN
    RAISE EXCEPTION 'public_id backfill incomplete: some rows still NULL';
  END IF;
END
$$;

-- Make column NOT NULL now that backfill and unique index are in place
ALTER TABLE public.profiles ALTER COLUMN public_id SET NOT NULL;

-- Create trigger function to auto-generate `public_id` for new inserts.
-- We use pg_advisory_xact_lock to serialize generation across concurrent transactions.
CREATE OR REPLACE FUNCTION public.generate_public_id() RETURNS trigger AS $$
DECLARE
  new_id text;
  tries integer := 0;
  lock_key bigint := 987654321; -- arbitrary constant for advisory lock
BEGIN
  IF NEW.public_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(lock_key);

  LOOP
    new_id := lpad(((floor(random()*90000000) + 10000000)::int)::text, 8, '0');
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE public_id = new_id) THEN
      NEW.public_id := new_id;
      RETURN NEW;
    END IF;
    tries := tries + 1;
    IF tries > 200 THEN
      RAISE EXCEPTION 'unable to generate unique public_id after % attempts', tries;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Install trigger if not present
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'before_insert_generate_public_id') THEN
    CREATE TRIGGER before_insert_generate_public_id
      BEFORE INSERT ON public.profiles
      FOR EACH ROW
      EXECUTE FUNCTION public.generate_public_id();
  END IF;
END$$;

COMMIT;

-- Down migration (rollback) instructions:
-- To rollback, run the following statements (recommended to run with care and a backup):
--
-- BEGIN;
-- DROP TRIGGER IF EXISTS before_insert_generate_public_id ON public.profiles;
-- DROP FUNCTION IF EXISTS public.generate_public_id();
-- COMMIT;
--
-- -- Drop index concurrently (must not be inside a transaction):
-- DROP INDEX CONCURRENTLY IF EXISTS profiles_public_id_idx;
--
-- BEGIN;
-- ALTER TABLE IF EXISTS public.profiles DROP COLUMN IF EXISTS public_id;
-- COMMIT;

-- Verification queries:
-- SELECT count(*) FROM public.profiles WHERE public_id IS NULL; -- expect 0
-- SELECT count(public_id), count(DISTINCT public_id) FROM public.profiles; -- counts should match

-- End of migration
