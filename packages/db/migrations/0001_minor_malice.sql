CREATE TYPE "public"."metrics_platform" AS ENUM('devto', 'hashnode', 'manual');--> statement-breakpoint
CREATE TYPE "public"."recommendation_type" AS ENUM('topic', 'format', 'length', 'keyword', 'improvement');--> statement-breakpoint
CREATE TABLE "post_performance_metrics" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" text NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL,
	"comments" integer DEFAULT 0 NOT NULL,
	"shares" integer DEFAULT 0 NOT NULL,
	"engagement_rate" real DEFAULT 0 NOT NULL,
	"platform" text NOT NULL,
	"recorded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "content_recommendations" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"recommendation_type" "recommendation_type" NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"reasoning" text NOT NULL,
	"supporting_data" jsonb,
	"confidence_score" real NOT NULL,
	"helpful_rating" boolean,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "post_performance_metrics" ADD CONSTRAINT "post_performance_metrics_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_recommendations" ADD CONSTRAINT "content_recommendations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "postPerformanceMetrics_postId_idx" ON "post_performance_metrics" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "postPerformanceMetrics_recordedAt_idx" ON "post_performance_metrics" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX "contentRecommendations_workspaceId_idx" ON "content_recommendations" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "contentRecommendations_confidenceScore_idx" ON "content_recommendations" USING btree ("confidence_score");
