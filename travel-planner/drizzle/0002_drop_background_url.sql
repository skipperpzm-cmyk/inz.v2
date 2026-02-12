-- Rollback migration: remove background_url from users table if present
ALTER TABLE "users" DROP COLUMN IF EXISTS "background_url";
--> statement-breakpoint
