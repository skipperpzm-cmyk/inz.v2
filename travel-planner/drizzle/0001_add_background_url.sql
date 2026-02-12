-- Add background_url to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "background_url" text;
--> statement-breakpoint
