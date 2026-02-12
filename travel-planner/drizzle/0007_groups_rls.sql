-- Migration: 0007_groups_rls.sql
-- Enable Row Level Security on `groups` and `group_members` and create explicit policies.
-- Idempotent: drops/recreates named policies and guards creation with existence checks.

-- Enable RLS on public.groups
ALTER TABLE IF EXISTS public.groups ENABLE ROW LEVEL SECURITY;

-- 1) groups: allow public read for non-private groups
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_tables WHERE schemaname = 'public' AND tablename = 'groups') THEN
    PERFORM 1;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_tables WHERE schemaname = 'public' AND tablename = 'groups'
  ) THEN
    -- drop and recreate SELECT policy: public non-private groups
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'groups' AND policyname = 'groups_select_public') THEN
      DROP POLICY IF EXISTS groups_select_public ON public.groups;
    END IF;
    CREATE POLICY groups_select_public
      ON public.groups
      FOR SELECT
      USING ( is_private = false );

    -- drop and recreate SELECT policy: allow members to read private groups
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'groups' AND policyname = 'groups_select_member') THEN
      DROP POLICY IF EXISTS groups_select_member ON public.groups;
    END IF;
    CREATE POLICY groups_select_member
      ON public.groups
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.group_members gm WHERE gm.group_id = public.groups.id AND gm.user_id = auth.uid()
        )
      );

    -- INSERT: only authenticated users; ensure created_by matches auth.uid()
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'groups' AND policyname = 'groups_insert_authenticated') THEN
      DROP POLICY IF EXISTS groups_insert_authenticated ON public.groups;
    END IF;
    CREATE POLICY groups_insert_authenticated
      ON public.groups
      FOR INSERT
      WITH CHECK ( auth.uid() IS NOT NULL AND created_by = auth.uid() );

    -- UPDATE: only group creator
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'groups' AND policyname = 'groups_update_owner') THEN
      DROP POLICY IF EXISTS groups_update_owner ON public.groups;
    END IF;
    CREATE POLICY groups_update_owner
      ON public.groups
      FOR UPDATE
      USING ( created_by = auth.uid() )
      WITH CHECK ( created_by = auth.uid() );

    -- DELETE: only group creator
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'groups' AND policyname = 'groups_delete_owner') THEN
      DROP POLICY IF EXISTS groups_delete_owner ON public.groups;
    END IF;
    CREATE POLICY groups_delete_owner
      ON public.groups
      FOR DELETE
      USING ( created_by = auth.uid() );

    -- Force RLS to ensure policies are enforced
    ALTER TABLE IF EXISTS public.groups FORCE ROW LEVEL SECURITY;
  END IF;
END
$$;

-- Enable RLS on public.group_members
ALTER TABLE IF EXISTS public.group_members ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_tables WHERE schemaname = 'public' AND tablename = 'group_members'
  ) THEN
    -- SELECT: allow users to see their own memberships
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'group_members' AND policyname = 'group_members_select_self') THEN
      DROP POLICY IF EXISTS group_members_select_self ON public.group_members;
    END IF;
    CREATE POLICY group_members_select_self
      ON public.group_members
      FOR SELECT
      USING ( user_id = auth.uid() );

    -- Optional: allow group admins to read membership lists
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'group_members' AND policyname = 'group_members_select_admin') THEN
      DROP POLICY IF EXISTS group_members_select_admin ON public.group_members;
    END IF;
    CREATE POLICY group_members_select_admin
      ON public.group_members
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.group_members gm WHERE gm.group_id = public.group_members.group_id AND gm.user_id = auth.uid() AND gm.role = 'admin'
        )
      );

    -- INSERT: allow only group creator or admin (triggers run as definer and bypass RLS)
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'group_members' AND policyname = 'group_members_insert_allowed') THEN
      DROP POLICY IF EXISTS group_members_insert_allowed ON public.group_members;
    END IF;
    CREATE POLICY group_members_insert_allowed
      ON public.group_members
      FOR INSERT
      WITH CHECK (
        auth.uid() IS NOT NULL AND (
          EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_members.group_id AND g.created_by = auth.uid()) OR
          EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_members.group_id AND gm.user_id = auth.uid() AND gm.role = 'admin')
        )
      );

    -- UPDATE: allow role changes only by group admin
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'group_members' AND policyname = 'group_members_update_admin') THEN
      DROP POLICY IF EXISTS group_members_update_admin ON public.group_members;
    END IF;
    CREATE POLICY group_members_update_admin
      ON public.group_members
      FOR UPDATE
      USING (
        EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = public.group_members.group_id AND gm.user_id = auth.uid() AND gm.role = 'admin')
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = public.group_members.group_id AND gm.user_id = auth.uid() AND gm.role = 'admin')
      );

    -- DELETE: allow member to leave (self) or admin to remove
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'group_members' AND policyname = 'group_members_delete_self_or_admin') THEN
      DROP POLICY IF EXISTS group_members_delete_self_or_admin ON public.group_members;
    END IF;
    CREATE POLICY group_members_delete_self_or_admin
      ON public.group_members
      FOR DELETE
      USING (
        user_id = auth.uid() OR
        EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = public.group_members.group_id AND gm.user_id = auth.uid() AND gm.role = 'admin')
      );

    ALTER TABLE IF EXISTS public.group_members FORCE ROW LEVEL SECURITY;
  END IF;
END
$$;

-- Notes:
-- - Policies are explicit and idempotent. Triggers using SECURITY DEFINER will bypass RLS when necessary.
-- - Adjust the admin selection logic if you prefer different admin semantics (e.g., use groups.created_by as implicit admin).
