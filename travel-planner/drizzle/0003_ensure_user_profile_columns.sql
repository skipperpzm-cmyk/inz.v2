-- Ensure `avatar_url` and `background_url` exist on users table and create optional indexes
ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS avatar_url text;

ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS background_url text;

-- Optional indexes: useful only if you plan to query/filter by these columns.
-- These are safe to create (IF NOT EXISTS) and will be skipped if already present.
CREATE INDEX IF NOT EXISTS idx_users_avatar_url ON users (avatar_url);
CREATE INDEX IF NOT EXISTS idx_users_background_url ON users (background_url);
