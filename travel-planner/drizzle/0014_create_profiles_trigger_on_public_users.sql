-- Migration: 0014_create_profiles_trigger_on_public_users.sql
-- Creates a trigger on public.users to ensure a public.profiles row
-- exists for every user. Idempotent and safe.

-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION public.create_profile_after_public_users_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  BEGIN
    INSERT INTO public.profiles (id, username, created_at)
    VALUES (NEW.id, NEW.username, now())
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Swallow errors to avoid breaking user creation paths.
    NULL;
  END;

  RETURN NULL; -- AFTER trigger
END;
$$;

-- Create trigger only if it does not already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE t.tgname = 'trg_create_profile_on_public_users'
      AND n.nspname = 'public'
      AND c.relname = 'users'
  ) THEN
    CREATE TRIGGER trg_create_profile_on_public_users
    AFTER INSERT ON public.users
    FOR EACH ROW
    WHEN (pg_trigger_depth() = 0)
    EXECUTE FUNCTION public.create_profile_after_public_users_insert();
  END IF;
END;
$$;
