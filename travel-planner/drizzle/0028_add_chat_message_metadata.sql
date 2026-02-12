-- 0028_add_chat_message_metadata.sql
-- Add metadata fields to chat_messages for message type and status

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'text';

CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages (created_at);
