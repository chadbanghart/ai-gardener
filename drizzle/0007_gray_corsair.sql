ALTER TABLE "plants" ADD COLUMN "pruned_dates" timestamp with time zone[];--> statement-breakpoint
ALTER TABLE "plants" ADD COLUMN "water_interval_days" integer;--> statement-breakpoint
ALTER TABLE "plants" ADD COLUMN "fertilize_interval_days" integer;--> statement-breakpoint
ALTER TABLE "plants" ADD COLUMN "prune_interval_days" integer;