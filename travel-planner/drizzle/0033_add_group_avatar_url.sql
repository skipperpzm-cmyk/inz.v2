-- Migration: 0033_add_group_avatar_url.sql
-- Add avatar_url column to public.groups for group avatars

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'groups' AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE public.groups ADD COLUMN avatar_url text NULL;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public' AND tablename = 'groups' AND indexname = 'idx_groups_avatar_url'
  ) THEN
    CREATE INDEX idx_groups_avatar_url ON public.groups (avatar_url);
  END IF;
END
$$;
