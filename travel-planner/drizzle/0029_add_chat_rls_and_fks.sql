-- 0029_add_chat_rls_and_fks.sql
-- Add RLS policies for chat_messages and reconcile missing FK constraints

-- Ensure RLS is enabled on chat_messages
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Direct message read policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chat_messages'
      AND policyname = 'select_chat_messages_direct'
  ) THEN
    EXECUTE 'CREATE POLICY select_chat_messages_direct ON public.chat_messages FOR SELECT TO authenticated USING (sender_id = auth.uid() OR receiver_id = auth.uid())';
  END IF;
END $$;

-- Direct message insert policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chat_messages'
      AND policyname = 'insert_chat_messages_direct'
  ) THEN
    EXECUTE 'CREATE POLICY insert_chat_messages_direct ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid() AND receiver_id IS NOT NULL)';
  END IF;
END $$;

-- Group message policies, only if group_members table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'group_members'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'chat_messages'
        AND policyname = 'select_chat_messages_group'
    ) THEN
      EXECUTE 'CREATE POLICY select_chat_messages_group ON public.chat_messages FOR SELECT TO authenticated USING (group_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = chat_messages.group_id AND gm.user_id = auth.uid()))';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'chat_messages'
        AND policyname = 'insert_chat_messages_group'
    ) THEN
      EXECUTE 'CREATE POLICY insert_chat_messages_group ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid() AND group_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = chat_messages.group_id AND gm.user_id = auth.uid()))';
    END IF;
  END IF;
END $$;

-- Friend invites FK constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'friend_invites_from_user_id_users_id_fk'
  ) THEN
    ALTER TABLE public.friend_invites
      ADD CONSTRAINT friend_invites_from_user_id_users_id_fk
      FOREIGN KEY (from_user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'friend_invites_to_user_id_users_id_fk'
  ) THEN
    ALTER TABLE public.friend_invites
      ADD CONSTRAINT friend_invites_to_user_id_users_id_fk
      FOREIGN KEY (to_user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- User friends FK constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_friends_user_id_users_id_fk'
  ) THEN
    ALTER TABLE public.user_friends
      ADD CONSTRAINT user_friends_user_id_users_id_fk
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_friends_friend_id_users_id_fk'
  ) THEN
    ALTER TABLE public.user_friends
      ADD CONSTRAINT user_friends_friend_id_users_id_fk
      FOREIGN KEY (friend_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- chat_messages group_id FK constraint if groups table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'groups'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'chat_messages_group_id_groups_id_fk'
    ) THEN
      ALTER TABLE public.chat_messages
        ADD CONSTRAINT chat_messages_group_id_groups_id_fk
        FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;
