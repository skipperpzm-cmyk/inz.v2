-- Migration: 0006_group_creator_member_trigger.sql
-- Creates a trigger function and trigger that inserts the group's creator
-- into `group_members` as an 'admin' after a new group is created.
-- Idempotent: function uses ON CONFLICT DO NOTHING and trigger creation is guarded.

CREATE OR REPLACE FUNCTION public.add_group_creator_as_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  BEGIN
    INSERT INTO public.group_members (group_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'admin')
    ON CONFLICT (group_id, user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Swallow errors to avoid failing group creation due to member insert issues
    NULL;
  END;

  RETURN NULL; -- AFTER trigger returns null
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE t.tgname = 'trg_add_group_creator_on_groups'
      AND n.nspname = 'public'
      AND c.relname = 'groups'
  ) THEN
    CREATE TRIGGER trg_add_group_creator_on_groups
    AFTER INSERT ON public.groups
    FOR EACH ROW
    WHEN (pg_trigger_depth() = 0)
    EXECUTE FUNCTION public.add_group_creator_as_admin();
  END IF;
END
$$;

-- Notes:
-- - The function is SECURITY DEFINER to allow insertion into `group_members` even
--   when row-level security is in effect for client roles (service-role still bypasses RLS).
-- - The INSERT uses ON CONFLICT DO NOTHING to prevent duplicate memberships.
-- - Errors are swallowed so group creation won't fail if member insertion has transient issues.
