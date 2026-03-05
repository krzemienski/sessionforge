CREATE TYPE "public"."scheduled_publication_status" AS ENUM('pending', 'publishing', 'published', 'failed');--> statement-breakpoint
CREATE TABLE "scheduled_publications" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"post_id" text NOT NULL,
	"platforms" jsonb NOT NULL,
	"scheduled_for" timestamp NOT NULL,
	"status" "scheduled_publication_status" DEFAULT 'pending',
	"qstash_schedule_id" text,
	"published_at" timestamp,
	"error" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "scheduled_publications" ADD CONSTRAINT "scheduled_publications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_publications" ADD CONSTRAINT "scheduled_publications_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scheduledPublications_workspaceId_idx" ON "scheduled_publications" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "scheduledPublications_postId_idx" ON "scheduled_publications" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "scheduledPublications_scheduledFor_idx" ON "scheduled_publications" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX "scheduledPublications_status_idx" ON "scheduled_publications" USING btree ("status");