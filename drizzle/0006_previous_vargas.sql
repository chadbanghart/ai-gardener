ALTER TABLE "plants" ADD COLUMN "planted_on" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "plants" ADD COLUMN "watered_dates" timestamp with time zone[];--> statement-breakpoint
ALTER TABLE "plants" ADD COLUMN "fertilized_dates" timestamp with time zone[];