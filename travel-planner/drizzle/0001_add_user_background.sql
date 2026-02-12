-- Add nullable background_url column to users table
ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS background_url text;
