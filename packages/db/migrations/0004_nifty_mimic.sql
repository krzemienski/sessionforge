CREATE TYPE "public"."social_platform" AS ENUM('twitter', 'linkedin');--> statement-breakpoint
CREATE TABLE "social_analytics" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"post_id" text NOT NULL,
	"platform" "social_platform" NOT NULL,
	"impressions" integer DEFAULT 0,
	"likes" integer DEFAULT 0,
	"shares" integer DEFAULT 0,
	"comments" integer DEFAULT 0,
	"clicks" integer DEFAULT 0,
	"raw_metrics" jsonb,
	"synced_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "social_analytics" ADD CONSTRAINT "social_analytics_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_analytics" ADD CONSTRAINT "social_analytics_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "socialAnalytics_workspaceId_idx" ON "social_analytics" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "socialAnalytics_postId_idx" ON "social_analytics" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "socialAnalytics_platform_idx" ON "social_analytics" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "socialAnalytics_syncedAt_idx" ON "social_analytics" USING btree ("synced_at");--> statement-breakpoint
CREATE UNIQUE INDEX "socialAnalytics_postId_platform_uidx" ON "social_analytics" USING btree ("post_id","platform");