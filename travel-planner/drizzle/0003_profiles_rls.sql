-- Migration: 0003_profiles_rls.sql
-- Enable Row Level Security on public.profiles and create explicit policies.
-- Idempotent: uses IF EXISTS / DROP POLICY IF EXISTS where applicable.

-- Enable RLS (safe to run multiple times)
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

-- Revoke broad privileges from public/authenticated if you want to be explicit
-- (optional; comment out if your project manages grants elsewhere).
-- REVOKE ALL ON TABLE public.profiles FROM public;
-- REVOKE ALL ON TABLE public.profiles FROM authenticated;

-- 1) SELECT: allow unrestricted SELECT access for all roles
DO $$
BEGIN
  -- drop existing policy if present so we can recreate it explicitly
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_select_all'
  ) THEN
    DROP POLICY IF EXISTS profiles_select_all ON public.profiles;
  END IF;
  CREATE POLICY profiles_select_all
    ON public.profiles
    FOR SELECT
    USING (true);
END
$$;

-- 2) UPDATE: allow UPDATE only when profiles.id = auth.uid()
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_update_owner'
  ) THEN
    DROP POLICY IF EXISTS profiles_update_owner ON public.profiles;
  END IF;
  CREATE POLICY profiles_update_owner
    ON public.profiles
    FOR UPDATE
    USING ( id = auth.uid() )
    WITH CHECK ( id = auth.uid() );
END
$$;

-- 3) INSERT: disallow client-side INSERTs completely (allow nothing)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_insert_none'
  ) THEN
    DROP POLICY IF EXISTS profiles_insert_none ON public.profiles;
  END IF;
  CREATE POLICY profiles_insert_none
    ON public.profiles
    FOR INSERT
    WITH CHECK (false);
END
$$;

-- 4) DELETE: disallow DELETE for all roles
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_delete_none'
  ) THEN
    DROP POLICY IF EXISTS profiles_delete_none ON public.profiles;
  END IF;
  CREATE POLICY profiles_delete_none
    ON public.profiles
    FOR DELETE
    USING (false);
END
$$;

-- Ensure policies are applied (no-op if already enabled)
ALTER TABLE IF EXISTS public.profiles FORCE ROW LEVEL SECURITY;

-- Notes:
-- - `profiles_select_all` permits SELECT to everyone (anonymous and authenticated).
-- - `profiles_update_owner` restricts UPDATE to the owning user only (uses `auth.uid()`).
-- - `profiles_insert_none` prevents client-side INSERTs entirely; server/service-role inserts still work because service role bypasses RLS.
-- - `profiles_delete_none` prevents deletes by any client role.
-- - All policy creation is guarded by existence checks and uses DROP POLICY IF EXISTS where helpful to make the migration idempotent.
