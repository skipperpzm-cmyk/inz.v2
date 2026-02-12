-- 0022_add_public_id.sql
-- Add a stable, unique 8-digit numeric `public_id` to public.profiles
-- 1) add nullable column
-- 2) backfill existing rows with unique 8-digit numeric ids
-- 3) add unique index and set NOT NULL
-- 4) create trigger to auto-generate for future inserts

BEGIN;

-- 1) Add column if missing
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS public_id text;

-- 2) Backfill: generate an 8-digit numeric string for rows missing a public_id
DO $$
DECLARE
  r RECORD;
  new_id text;
  tries integer;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE public_id IS NULL LOOP
    tries := 0;
    LOOP
      -- generate an 8-digit number where first digit is non-zero
      new_id := lpad(((floor(random()*90000000) + 10000000)::int)::text, 8, '0');
      IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE public_id = new_id) THEN
        UPDATE public.profiles SET public_id = new_id WHERE id = r.id;
        EXIT;
      END IF;
      tries := tries + 1;
      IF tries > 20 THEN
        RAISE EXCEPTION 'unable to generate unique public_id for profile % after 20 tries', r.id;
      END IF;
    END LOOP;
  END LOOP;
END$$;

-- 3) Create unique index and enforce NOT NULL
CREATE UNIQUE INDEX IF NOT EXISTS profiles_public_id_idx ON public.profiles (public_id);
ALTER TABLE public.profiles ALTER COLUMN public_id SET NOT NULL;

-- 4) Trigger function to generate public_id on insert (if not provided)
CREATE OR REPLACE FUNCTION public.generate_public_id() RETURNS trigger AS $$
DECLARE
  new_id text;
  tries integer := 0;
BEGIN
  IF NEW.public_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  LOOP
    new_id := lpad(((floor(random()*90000000) + 10000000)::int)::text, 8, '0');
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE public_id = new_id) THEN
      NEW.public_id := new_id;
      RETURN NEW;
    END IF;
    tries := tries + 1;
    IF tries > 50 THEN
      RAISE EXCEPTION 'unable to generate unique public_id after % attempts', tries;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'before_insert_generate_public_id'
  ) THEN
    CREATE TRIGGER before_insert_generate_public_id
      BEFORE INSERT ON public.profiles
      FOR EACH ROW
      EXECUTE FUNCTION public.generate_public_id();
  END IF;
END$$;

COMMIT;

-- Post-migration: verify row counts and archive table if desired.
-- IMPORTANT: take a DB backup before applying in production.
