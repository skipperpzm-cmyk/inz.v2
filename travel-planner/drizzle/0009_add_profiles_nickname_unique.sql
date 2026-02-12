-- Migration: 0009_add_profiles_nickname_unique.sql
-- Add a nullable `nickname` column to public.profiles and enforce uniqueness via a unique index.
DO $$
BEGIN
  -- Add column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'nickname'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN nickname text NULL;
  END IF;

  -- Create unique index on nickname (allows multiple NULLs)
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_indexes WHERE schemaname = 'public' AND tablename = 'profiles' AND indexname = 'idx_profiles_nickname'
  ) THEN
    CREATE UNIQUE INDEX idx_profiles_nickname ON public.profiles (nickname);
  END IF;
END
$$;

-- Notes:
-- - `nickname` is nullable so existing rows are unaffected.
-- - Unique index prevents duplicate non-NULL nicknames at the DB level.
