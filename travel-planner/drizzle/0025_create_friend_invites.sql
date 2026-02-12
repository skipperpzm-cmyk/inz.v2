-- 0025_create_friend_invites.sql
-- Create friend_invites and user_friends tables for friend invitations

CREATE TABLE IF NOT EXISTS public.friend_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_friend_invites_to_user_id ON public.friend_invites (to_user_id);
CREATE INDEX IF NOT EXISTS idx_friend_invites_status ON public.friend_invites (status);

-- Prevent duplicate pending invites between the same users
CREATE UNIQUE INDEX IF NOT EXISTS uq_friend_invites_from_to_pending ON public.friend_invites (from_user_id, to_user_id) WHERE (status = 'pending');

-- Table for accepted friendships (directional: user -> friend)
CREATE TABLE IF NOT EXISTS public.user_friends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  friend_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_friends_pair ON public.user_friends (user_id, friend_id);
