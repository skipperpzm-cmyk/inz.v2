-- 0030_rename_user_search_logs_to_add_friend_logs.sql
-- Rename user_search_logs to add_friend_logs for add-friend flows

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'user_search_logs' AND n.nspname = 'public'
  ) THEN
    ALTER TABLE public.user_search_logs RENAME TO add_friend_logs;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'idx_user_search_logs_user' AND n.nspname = 'public'
  ) THEN
    ALTER INDEX public.idx_user_search_logs_user RENAME TO idx_add_friend_logs_user;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'idx_user_search_logs_created_at' AND n.nspname = 'public'
  ) THEN
    ALTER INDEX public.idx_user_search_logs_created_at RENAME TO idx_add_friend_logs_created_at;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'insert_user_search_logs'
      AND schemaname = 'public'
      AND tablename = 'add_friend_logs'
  ) THEN
    ALTER POLICY insert_user_search_logs ON public.add_friend_logs RENAME TO insert_add_friend_logs;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'select_user_search_logs'
      AND schemaname = 'public'
      AND tablename = 'add_friend_logs'
  ) THEN
    ALTER POLICY select_user_search_logs ON public.add_friend_logs RENAME TO select_add_friend_logs;
  END IF;
END $$;
