ALTER TABLE "garden_locations"
ALTER COLUMN "sun_amount"
SET DATA TYPE text[]
USING CASE
  WHEN "sun_amount" IS NULL OR btrim("sun_amount") = '' THEN NULL
  ELSE ARRAY["sun_amount"]
END;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "experience_level" text;--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN IF EXISTS "sunlight";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN IF EXISTS "garden_type";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN IF EXISTS "irrigation_style";
