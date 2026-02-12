-- Migration: 0008_add_default_uuid_to_groups.sql
-- Adds a DEFAULT of gen_random_uuid() to public.groups.id
-- Idempotent: only applies the ALTER if the default is not already set

DO $$
BEGIN
  -- Ensure pgcrypto extension is available for gen_random_uuid()
  PERFORM 1;
  CREATE EXTENSION IF NOT EXISTS pgcrypto;

  -- Only set the default if it isn't already set to gen_random_uuid()
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'groups'
      AND c.column_name = 'id'
      AND COALESCE(c.column_default, '') LIKE '%gen_random_uuid()%'
  ) THEN
    ALTER TABLE IF EXISTS public.groups
    ALTER COLUMN id SET DEFAULT gen_random_uuid();
  END IF;
END
$$;

-- Notes:
-- - This migration is safe to run multiple times.
-- - It leaves the primary key constraint intact and only sets a DB-side default.
-- - Triggers and RLS should continue to operate normally; the trigger that inserts
--   the creator into `group_members` uses NEW.id and will see the DB-generated id
--   when inserts that omit the `id` column occur.
