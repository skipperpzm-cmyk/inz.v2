-- Migration: 0001_create_profiles.sql
-- Creates a `profiles` table linked to auth.users(id)
-- Idempotent: safe to run multiple times (no-op if table/index exist)

DO $$
BEGIN
  -- Create table only if it does not already exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_tables WHERE schemaname = 'public' AND tablename = 'profiles'
  ) THEN
    CREATE TABLE public.profiles (
      id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      username text NULL,
      full_name text NULL,
      avatar_url text NULL,
      bio text NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END
$$;

-- Ensure unique index on username (allowing NULLs). Create only if not present.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_indexes WHERE schemaname = 'public' AND tablename = 'profiles' AND indexname = 'idx_profiles_username'
  ) THEN
    CREATE UNIQUE INDEX idx_profiles_username ON public.profiles (username);
  END IF;
END
$$;

-- Ensure table-level ownership (optional for Supabase). Uncomment if you need to set owner:
-- ALTER TABLE public.profiles OWNER TO your_db_user;

-- Notes:
-- - `id` is both PRIMARY KEY and FK to `auth.users(id)` with ON DELETE CASCADE
-- - `username` is nullable initially; uniqueness enforced via unique index
-- - Migration is safe to run multiple times; creation steps are conditional
