-- Migration: 0005_create_group_members.sql
-- Creates `group_members` table with constraints and indexes
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
    SELECT 1 FROM pg_catalog.pg_tables WHERE schemaname = 'public' AND tablename = 'group_members'
  ) THEN
    CREATE TABLE public.group_members (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      role text NOT NULL DEFAULT 'member',
      joined_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT group_members_role_check CHECK (role IN ('member', 'admin'))
    );
  END IF;
END
$$;

-- Ensure uniqueness on (group_id, user_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_indexes WHERE schemaname = 'public' AND tablename = 'group_members' AND indexname = 'idx_group_members_group_user'
  ) THEN
    CREATE UNIQUE INDEX idx_group_members_group_user ON public.group_members (group_id, user_id);
  END IF;
END
$$;

-- Index on group_id for fast lookups
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_indexes WHERE schemaname = 'public' AND tablename = 'group_members' AND indexname = 'idx_group_members_group_id'
  ) THEN
    CREATE INDEX idx_group_members_group_id ON public.group_members (group_id);
  END IF;
END
$$;

-- Notes:
-- - `id` defaults to `gen_random_uuid()` (pgcrypto extension required).
-- - `role` is constrained to 'member' or 'admin' via CHECK.
-- - Uniqueness and indexes are created idempotently.
