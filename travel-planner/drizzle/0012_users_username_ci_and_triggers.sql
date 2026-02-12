-- Migration: 0012_users_username_ci_and_triggers.sql
-- Sync users.username with profiles.username, deduplicate case-insensitively,
-- create case-insensitive unique index on users.username, and add triggers
-- to keep profiles.username in sync with users.username on INSERT/UPDATE.
-- Create trigger function to sync profiles.username after users INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.sync_profiles_username_from_users()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- update existing profile row if present
  UPDATE public.profiles SET username = NEW.username WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  rec RECORD;
  ids uuid[];
BEGIN
  -- 1) Copy profiles.username into users.username where available
  UPDATE public.users u
  SET username = p.username
  FROM public.profiles p
  WHERE u.id = p.id AND p.username IS NOT NULL AND (u.username IS NULL OR u.username <> p.username);

  -- 2) For remaining NULL users.username, try to use local part of email
  UPDATE public.users
  SET username = lower(split_part(email, '@', 1))
  WHERE username IS NULL AND email IS NOT NULL;

  -- 3) Any still NULL -> generate stable fallback
  UPDATE public.users
  SET username = ('user_' || substring(id::text,1,8))
  WHERE username IS NULL;

  -- 4) Trim surrounding whitespace but preserve original casing
  UPDATE public.users
  SET username = trim(username)
  WHERE username IS NOT NULL;

  -- 5) Resolve case-insensitive duplicates by appending stable suffix
  FOR rec IN
    SELECT lower(username) AS uname, array_agg(id ORDER BY id) AS ids, count(*) AS cnt
    FROM public.users
    WHERE username IS NOT NULL
    GROUP BY lower(username)
    HAVING count(*) > 1
  LOOP
    ids := rec.ids;
    FOR i IN 2 .. array_length(ids,1) LOOP
      UPDATE public.users
      SET username = username || '_' || substring((ids[i])::text,1,8)
      WHERE id = ids[i];
    END LOOP;
  END LOOP;

  -- 6) Final trim pass (preserve case)
  UPDATE public.users SET username = trim(username);

  -- 7) Ensure no case-insensitive duplicates remain
  IF EXISTS (
    SELECT 1 FROM (
      SELECT lower(username) AS lu, count(*) AS c
      FROM public.users
      GROUP BY lower(username)
      HAVING count(*) > 1
    ) t
  ) THEN
    RAISE EXCEPTION 'Case-insensitive duplicates remain in users.username; manual review required';
  END IF;

  -- 8) Create case-insensitive unique index on users.username
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_indexes WHERE schemaname = 'public' AND tablename = 'users' AND indexname = 'idx_users_username_ci'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX idx_users_username_ci ON public.users (lower(username));';
  END IF;

  -- 9) Trigger creation handled after DO block

  -- 10) Create triggers if not exists
  -- AFTER INSERT trigger
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON t.tgrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE t.tgname = 'trg_sync_profiles_after_users_insert' AND n.nspname = 'public' AND c.relname = 'users'
  ) THEN
    EXECUTE 'CREATE TRIGGER trg_sync_profiles_after_users_insert AFTER INSERT ON public.users FOR EACH ROW WHEN (NEW.username IS NOT NULL) EXECUTE FUNCTION public.sync_profiles_username_from_users();';
  END IF;

  -- AFTER UPDATE OF username trigger
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON t.tgrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE t.tgname = 'trg_sync_profiles_after_users_update' AND n.nspname = 'public' AND c.relname = 'users'
  ) THEN
    EXECUTE 'CREATE TRIGGER trg_sync_profiles_after_users_update AFTER UPDATE OF username ON public.users FOR EACH ROW WHEN (OLD.username IS DISTINCT FROM NEW.username) EXECUTE FUNCTION public.sync_profiles_username_from_users();';
  END IF;

  RAISE NOTICE '0012_users_username_ci_and_triggers applied';
END$$;
