-- Migration: 0013_auth_users_triggers.sql
-- Create triggers on auth.users to keep public.profiles.username in sync when auth users are inserted/updated.

-- Create AFTER INSERT trigger on auth.users
DO $$
BEGIN
  -- Only create triggers if auth.users has a 'username' column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'username'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger t JOIN pg_class c ON t.tgrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE t.tgname = 'trg_sync_profiles_after_auth_users_insert' AND n.nspname = 'auth' AND c.relname = 'users'
    ) THEN
      EXECUTE 'CREATE TRIGGER trg_sync_profiles_after_auth_users_insert AFTER INSERT ON auth.users FOR EACH ROW WHEN (NEW.username IS NOT NULL) EXECUTE FUNCTION public.sync_profiles_username_from_users();';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger t JOIN pg_class c ON t.tgrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE t.tgname = 'trg_sync_profiles_after_auth_users_update' AND n.nspname = 'auth' AND c.relname = 'users'
    ) THEN
      EXECUTE 'CREATE TRIGGER trg_sync_profiles_after_auth_users_update AFTER UPDATE OF username ON auth.users FOR EACH ROW WHEN (OLD.username IS DISTINCT FROM NEW.username) EXECUTE FUNCTION public.sync_profiles_username_from_users();';
    END IF;
  ELSE
    RAISE NOTICE 'auth.users.username column not present; skipping auth.users trigger creation';
  END IF;

  RAISE NOTICE '0013_auth_users_triggers applied';
END$$;
