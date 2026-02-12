DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'friend_invites'
      AND policyname = 'friend_invites_select_authenticated'
  ) THEN
    CREATE POLICY "friend_invites_select_authenticated"
      ON public.friend_invites
      FOR SELECT
      TO authenticated
      USING (from_user_id = auth.uid() OR to_user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'friend_invites'
      AND policyname = 'friend_invites_insert_authenticated'
  ) THEN
    CREATE POLICY "friend_invites_insert_authenticated"
      ON public.friend_invites
      FOR INSERT
      TO authenticated
      WITH CHECK (from_user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'friend_invites'
      AND policyname = 'friend_invites_update_authenticated'
  ) THEN
    CREATE POLICY "friend_invites_update_authenticated"
      ON public.friend_invites
      FOR UPDATE
      TO authenticated
      USING (from_user_id = auth.uid() OR to_user_id = auth.uid())
      WITH CHECK (from_user_id = auth.uid() OR to_user_id = auth.uid());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_friend_invites_from_user_id
  ON public.friend_invites (from_user_id);

CREATE INDEX IF NOT EXISTS idx_friend_invites_to_user_id
  ON public.friend_invites (to_user_id);
