-- Ensure the profile_slugs_archive table exists before backup and drop
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'profile_slugs_archive'
  ) THEN
    CREATE TABLE profile_slugs_archive_backup AS
    SELECT * FROM profile_slugs_archive;

    DROP TABLE profile_slugs_archive;
  END IF;
END $$;

-- Add a new column for public_id with the text type
ALTER TABLE users ADD COLUMN public_id_new TEXT;

-- Ensure the public_id column exists before the UPDATE statement
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'public_id'
  ) THEN
    UPDATE users SET public_id_new = public_id;
  END IF;
END $$;

-- Drop the old public_id column
ALTER TABLE users DROP COLUMN public_id;

-- Rename the new column to public_id
ALTER TABLE users RENAME COLUMN public_id_new TO public_id;

-- Ensure the username_slug column exists before backup and drop
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'username_slug'
  ) THEN
    CREATE TABLE users_username_slug_backup AS
    SELECT id, username_slug FROM users;

    ALTER TABLE users DROP COLUMN username_slug;
  END IF;
END $$;

-- Add 'online' column to the 'profiles' table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'online'
  ) THEN
    ALTER TABLE profiles ADD COLUMN online BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;
