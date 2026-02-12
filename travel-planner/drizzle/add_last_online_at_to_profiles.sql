-- Migration: add_last_online_at_to_profiles.sql
-- Adds last_online_at column to profiles table for heartbeat/online tracking

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_online_at timestamptz;
