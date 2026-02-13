-- Migration: 0032_create_group_invites.sql
-- Creates group_invites table for group invitations
-- Idempotent: safe to run multiple times

-- Ensure pgcrypto available for gen_random_uuid()
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_tables WHERE schemaname = 'public' AND tablename = 'group_invites'
  ) THEN
    CREATE TABLE public.group_invites (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
      from_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      to_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      status text NOT NULL DEFAULT 'pending',
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT group_invites_status_check CHECK (status IN ('pending', 'accepted', 'rejected'))
    );
  END IF;
END
$$;

-- Indexes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_indexes WHERE schemaname = 'public' AND tablename = 'group_invites' AND indexname = 'idx_group_invites_to_user_id'
  ) THEN
    CREATE INDEX idx_group_invites_to_user_id ON public.group_invites (to_user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_indexes WHERE schemaname = 'public' AND tablename = 'group_invites' AND indexname = 'idx_group_invites_status'
  ) THEN
    CREATE INDEX idx_group_invites_status ON public.group_invites (status);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_indexes WHERE schemaname = 'public' AND tablename = 'group_invites' AND indexname = 'uq_group_invites_group_to_pending'
  ) THEN
    CREATE UNIQUE INDEX uq_group_invites_group_to_pending ON public.group_invites (group_id, to_user_id) WHERE (status = 'pending');
  END IF;
END
$$;

-- Enable Row Level Security and policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_tables WHERE schemaname = 'public' AND tablename = 'group_invites') THEN
    ALTER TABLE public.group_invites ENABLE ROW LEVEL SECURITY;

    -- Select: allow sender or recipient to view
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'group_invites' AND policyname = 'group_invites_select_sender_or_recipient') THEN
      DROP POLICY IF EXISTS group_invites_select_sender_or_recipient ON public.group_invites;
    END IF;
    CREATE POLICY group_invites_select_sender_or_recipient
      ON public.group_invites
      FOR SELECT
      TO authenticated
      USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

    -- Insert: only group admins can invite
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'group_invites' AND policyname = 'group_invites_insert_admin') THEN
      DROP POLICY IF EXISTS group_invites_insert_admin ON public.group_invites;
    END IF;
    CREATE POLICY group_invites_insert_admin
      ON public.group_invites
      FOR INSERT
      TO authenticated
      WITH CHECK (
        auth.uid() IS NOT NULL
        AND from_user_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.group_members gm
          WHERE gm.group_id = group_invites.group_id
            AND gm.user_id = auth.uid()
            AND gm.role = 'admin'
        )
      );

    -- Delete: recipient can delete invite (accept/reject handled in API)
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'group_invites' AND policyname = 'group_invites_delete_recipient') THEN
      DROP POLICY IF EXISTS group_invites_delete_recipient ON public.group_invites;
    END IF;
    CREATE POLICY group_invites_delete_recipient
      ON public.group_invites
      FOR DELETE
      TO authenticated
      USING (to_user_id = auth.uid());
  END IF;
END
$$;
