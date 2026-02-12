-- Migration: 0010_remove_profiles_nickname_and_enforce_users_username.sql
-- Remove `nickname` from public.profiles and enforce uniqueness of `username` on public.users

-- Drop the nickname index if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_indexes WHERE schemaname = 'public' AND tablename = 'profiles' AND indexname = 'idx_profiles_nickname'
  ) THEN
    EXECUTE 'DROP INDEX IF EXISTS public.idx_profiles_nickname';
  END IF;
END$$;

-- Drop the nickname column if it exists
ALTER TABLE IF EXISTS public.profiles
  DROP COLUMN IF EXISTS nickname;

-- Ensure profiles.username unique index exists (should already exist from initial migration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_indexes WHERE schemaname = 'public' AND tablename = 'profiles' AND indexname = 'idx_profiles_username'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX idx_profiles_username ON public.profiles (username)';
  END IF;
END$$;

-- Ensure users.username uniqueness (add unique index on public.users.username if missing)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_indexes WHERE schemaname = 'public' AND tablename = 'users' AND indexname = 'idx_users_username'
    ) THEN
      EXECUTE 'CREATE UNIQUE INDEX idx_users_username ON public.users (username)';
    END IF;
  END IF;
END$$;
