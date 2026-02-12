-- 0027_create_user_search_logs.sql
-- Create user_search_logs table for tracking user search actions

CREATE TABLE IF NOT EXISTS public.user_search_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  query text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_search_logs_user ON public.user_search_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_user_search_logs_created_at ON public.user_search_logs (created_at);

-- Supabase RLS policies
ALTER TABLE public.user_search_logs ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_search_logs'
      AND policyname = 'insert_user_search_logs'
  ) THEN
    CREATE POLICY insert_user_search_logs ON public.user_search_logs
      FOR INSERT TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Allow users to select their own logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_search_logs'
      AND policyname = 'select_user_search_logs'
  ) THEN
    CREATE POLICY select_user_search_logs ON public.user_search_logs
      FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;
