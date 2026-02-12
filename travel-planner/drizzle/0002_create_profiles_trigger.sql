-- Migration: 0002_create_profiles_trigger.sql
-- Creates a trigger function and trigger to insert a row into public.profiles
-- whenever a new user is created in auth.users.
-- Idempotent and safe: function uses ON CONFLICT DO NOTHING and catches errors.

-- Create or replace the trigger function (safe to run multiple times)
CREATE OR REPLACE FUNCTION public.create_profile_after_auth_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Try to insert a minimal profile row. Use ON CONFLICT DO NOTHING to avoid
  -- errors if a profile already exists for the given id (race-safe).
  BEGIN
    INSERT INTO public.profiles (id)
    VALUES (NEW.id)
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Swallow any errors to ensure signup never fails because of this trigger.
    -- Logging with RAISE NOTICE is intentionally avoided to keep signup path light.
    NULL;
  END;

  RETURN NULL; -- trigger returns null for AFTER triggers
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
    WHERE t.tgname = 'trg_create_profile_on_auth_user'
      AND n.nspname = 'auth'
      AND c.relname = 'users'
  ) THEN
    CREATE TRIGGER trg_create_profile_on_auth_user
    AFTER INSERT ON auth.users
    FOR EACH ROW
    WHEN (pg_trigger_depth() = 0)
    EXECUTE FUNCTION public.create_profile_after_auth_insert();
  END IF;
END
$$;

-- Notes:
-- - The function is SECURITY DEFINER; it will execute with the privileges of the
--   function owner. Ensure the migration user has appropriate privileges or
--   adjust owner as needed in your environment.
-- - The INSERT uses ON CONFLICT DO NOTHING for concurrency safety.
-- - All errors are swallowed so user creation won't fail due to trigger issues.
