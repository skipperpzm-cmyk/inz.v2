-- Add the 'online' column to the 'profiles' table
ALTER TABLE profiles
ADD COLUMN online BOOLEAN DEFAULT FALSE NOT NULL;

-- Optional: Update the 'online' column for existing users (if needed)
-- UPDATE profiles SET online = FALSE;
