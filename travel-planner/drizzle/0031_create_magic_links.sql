CREATE TABLE IF NOT EXISTS "magic_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"ip" text,
	"user_agent" text,
	CONSTRAINT "magic_links_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magic_links_email_idx" ON "magic_links" ("email");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magic_links_user_id_idx" ON "magic_links" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magic_links_expires_at_idx" ON "magic_links" ("expires_at");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "magic_links" ADD CONSTRAINT "magic_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
