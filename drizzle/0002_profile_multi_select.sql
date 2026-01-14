ALTER TABLE "user_profiles" ALTER COLUMN "sunlight" SET DATA TYPE text[] USING CASE WHEN "sunlight" IS NULL THEN NULL ELSE ARRAY["sunlight"] END;
--> statement-breakpoint
ALTER TABLE "user_profiles" ALTER COLUMN "garden_type" SET DATA TYPE text[] USING CASE WHEN "garden_type" IS NULL THEN NULL ELSE ARRAY["garden_type"] END;
--> statement-breakpoint
ALTER TABLE "user_profiles" ALTER COLUMN "irrigation_style" SET DATA TYPE text[] USING CASE WHEN "irrigation_style" IS NULL THEN NULL ELSE ARRAY["irrigation_style"] END;
