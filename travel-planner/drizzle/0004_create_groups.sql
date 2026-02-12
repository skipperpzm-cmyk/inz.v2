-- Migration: 0004_create_groups.sql
-- Creates `groups` table for travel planning with constraints and indexes
-- Idempotent: safe to run multiple times (no-op if table/index exist)

DO $$
BEGIN
  -- Create table only if it does not already exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_tables WHERE schemaname = 'public' AND tablename = 'groups'
  ) THEN
    CREATE TABLE public.groups (
      id uuid PRIMARY KEY,
      name text NOT NULL,
      slug text NOT NULL,
      description text NULL,
      is_private boolean NOT NULL DEFAULT false,
      created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      -- Ensure `name` is not empty/whitespace-only
      CONSTRAINT groups_name_not_empty CHECK (trim(name) <> ''),
      -- Slug must be URL-safe: lower-case letters, numbers and hyphens, no leading/trailing hyphen
      CONSTRAINT groups_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
    );
  END IF;
END
$$;

-- Ensure unique index on slug (create only if absent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_indexes WHERE schemaname = 'public' AND tablename = 'groups' AND indexname = 'idx_groups_slug'
  ) THEN
    CREATE UNIQUE INDEX idx_groups_slug ON public.groups (slug);
  END IF;
END
$$;

-- Optional: add an index on created_by for lookups by creator
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_indexes WHERE schemaname = 'public' AND tablename = 'groups' AND indexname = 'idx_groups_created_by'
  ) THEN
    CREATE INDEX idx_groups_created_by ON public.groups (created_by);
  END IF;
END
$$;

-- Notes:
-- - `id` is a UUID primary key; choose to generate UUIDs in application or via DB defaults in a subsequent migration.
-- - `slug` uniqueness is enforced via `idx_groups_slug`.
-- - `groups_slug_format` restricts slugs to a conservative URL-safe subset. Adjust regex if you allow other characters.
-- - Migration guards make this file idempotent and safe to run multiple times.
