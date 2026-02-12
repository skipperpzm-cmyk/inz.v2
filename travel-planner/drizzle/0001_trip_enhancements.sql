DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'trips' AND column_name = 'start_date' AND data_type <> 'date'
    ) THEN
        ALTER TABLE "trips" ALTER COLUMN "start_date" TYPE date USING "start_date"::date;
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'trips' AND column_name = 'end_date' AND data_type <> 'date'
    ) THEN
        ALTER TABLE "trips" ALTER COLUMN "end_date" TYPE date USING "end_date"::date;
    END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "description" text;
--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "country" text;
--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "city" text;
--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "trip_type" text;
--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "duration_days" integer DEFAULT 1;
--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'planned';
--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "is_favorite" boolean DEFAULT false;
--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "updated_at" timestamptz DEFAULT now();
--> statement-breakpoint
UPDATE "trips"
SET
    "start_date" = COALESCE("start_date", CURRENT_DATE),
    "end_date" = COALESCE("end_date", CURRENT_DATE + INTERVAL '1 day');
--> statement-breakpoint
UPDATE "trips"
SET "country" = COALESCE("country", 'Unknown');
--> statement-breakpoint
UPDATE "trips"
SET "trip_type" = COALESCE("trip_type", 'city-break');
--> statement-breakpoint
UPDATE "trips"
SET "status" = COALESCE("status", 'planned');
--> statement-breakpoint
UPDATE "trips"
SET "is_favorite" = COALESCE("is_favorite", false);
--> statement-breakpoint
UPDATE "trips"
SET "updated_at" = COALESCE("updated_at", COALESCE("created_at", now()));
--> statement-breakpoint
UPDATE "trips"
SET "duration_days" = GREATEST(1, ("end_date" - "start_date")::int)
WHERE ("end_date" - "start_date") IS NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'trips' AND column_name = 'country' AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE "trips" ALTER COLUMN "country" SET NOT NULL;
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'trips' AND column_name = 'trip_type' AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE "trips" ALTER COLUMN "trip_type" SET NOT NULL;
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'trips' AND column_name = 'duration_days' AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE "trips" ALTER COLUMN "duration_days" SET NOT NULL;
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'trips' AND column_name = 'status' AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE "trips" ALTER COLUMN "status" SET NOT NULL;
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'trips' AND column_name = 'is_favorite' AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE "trips" ALTER COLUMN "is_favorite" SET NOT NULL;
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'trips' AND column_name = 'updated_at' AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE "trips" ALTER COLUMN "updated_at" SET NOT NULL;
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'trips' AND column_name = 'start_date' AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE "trips" ALTER COLUMN "start_date" SET NOT NULL;
    END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'trips' AND column_name = 'end_date' AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE "trips" ALTER COLUMN "end_date" SET NOT NULL;
    END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trips_user_id_idx" ON "trips" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trips_start_date_idx" ON "trips" ("start_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trips_user_id_start_date_idx" ON "trips" ("user_id", "start_date");
