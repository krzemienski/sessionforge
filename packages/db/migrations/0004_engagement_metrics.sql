CREATE TABLE "engagement_metrics" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"post_id" text NOT NULL,
	"published_at" timestamp,
	"views" integer DEFAULT 0,
	"clicks" integer DEFAULT 0,
	"shares" integer DEFAULT 0,
	"likes" integer DEFAULT 0,
	"comments" integer DEFAULT 0,
	"engagement_rate" real DEFAULT 0,
	"platform_specific_metrics" jsonb,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "engagement_metrics" ADD CONSTRAINT "engagement_metrics_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_metrics" ADD CONSTRAINT "engagement_metrics_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "engagementMetrics_workspaceId_idx" ON "engagement_metrics" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "engagementMetrics_postId_idx" ON "engagement_metrics" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "engagementMetrics_publishedAt_idx" ON "engagement_metrics" USING btree ("published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "engagementMetrics_postId_uidx" ON "engagement_metrics" USING btree ("post_id");
