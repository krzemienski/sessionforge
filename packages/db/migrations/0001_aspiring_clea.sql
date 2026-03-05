ALTER TABLE "posts" ADD COLUMN "scheduled_for" timestamp;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "timezone" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "qstash_schedule_id" text;