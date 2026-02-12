-- Down migration for 0023_add_public_id_safe.sql
-- WARNING: this will permanently remove `public_id` values from `public.profiles`.
-- Run only after confirming you no longer need public_id values or after taking a backup.

BEGIN;

-- Remove the trigger that auto-generates public_id
DROP TRIGGER IF EXISTS before_insert_generate_public_id ON public.profiles;

-- Remove the trigger function
DROP FUNCTION IF EXISTS public.generate_public_id();

-- Drop the unique index
DROP INDEX IF EXISTS profiles_public_id_idx;

-- Drop the column (permanent data loss)
ALTER TABLE IF EXISTS public.profiles DROP COLUMN IF EXISTS public_id;

COMMIT;

-- Notes:
-- 1) Back up data before running this down migration:
--    pg_dump -t public.profiles --data-only --column-inserts > profiles-public-id-backup.sql
-- 2) If you only want to remove the trigger+function but keep the column, skip the DROP COLUMN step above.
