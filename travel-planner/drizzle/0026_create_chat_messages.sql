-- 0026_create_chat_messages.sql
-- Create chat_messages table for direct and group chat

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_messages_target CHECK (
    (receiver_id IS NOT NULL AND group_id IS NULL) OR (receiver_id IS NULL AND group_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON public.chat_messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_receiver ON public.chat_messages (receiver_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_group ON public.chat_messages (group_id);
