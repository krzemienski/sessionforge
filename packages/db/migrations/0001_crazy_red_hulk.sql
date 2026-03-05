CREATE TABLE "content_recommendations" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"recommendation_type" text NOT NULL,
	"title" text NOT NULL,
	"reasoning" text NOT NULL,
	"suggested_content_type" "content_type",
	"suggested_publish_time" timestamp,
	"insight_id" text,
	"priority" integer DEFAULT 0,
	"status" text DEFAULT 'active' NOT NULL,
	"metadata" jsonb,
	"accepted_at" timestamp,
	"dismissed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "content_recommendations" ADD CONSTRAINT "content_recommendations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_recommendations" ADD CONSTRAINT "content_recommendations_insight_id_insights_id_fk" FOREIGN KEY ("insight_id") REFERENCES "public"."insights"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contentRecommendations_workspaceId_idx" ON "content_recommendations" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "contentRecommendations_status_idx" ON "content_recommendations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "contentRecommendations_insightId_idx" ON "content_recommendations" USING btree ("insight_id");--> statement-breakpoint
CREATE INDEX "contentRecommendations_priority_idx" ON "content_recommendations" USING btree ("priority");