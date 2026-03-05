CREATE TYPE "public"."workspace_member_role" AS ENUM('owner', 'editor', 'viewer');--> statement-breakpoint
CREATE TABLE "devto_integrations" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"api_key" text NOT NULL,
	"username" text,
	"enabled" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "devto_publications" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"post_id" text NOT NULL,
	"integration_id" text NOT NULL,
	"devto_article_id" integer NOT NULL,
	"devto_url" text,
	"published_as_draft" boolean DEFAULT false,
	"synced_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "workspace_activity" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text,
	"action" text NOT NULL,
	"resource_type" text,
	"resource_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "workspace_invites" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"email" text NOT NULL,
	"role" "workspace_member_role" DEFAULT 'viewer' NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"invited_by" text NOT NULL,
	"accepted_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "workspace_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "workspace_member_role" DEFAULT 'viewer' NOT NULL,
	"invited_by" text,
	"joined_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "content_triggers" ADD COLUMN "qstash_schedule_id" text;--> statement-breakpoint
ALTER TABLE "content_triggers" ADD COLUMN "debounce_minutes" integer DEFAULT 30;--> statement-breakpoint
ALTER TABLE "content_triggers" ADD COLUMN "watch_status" text;--> statement-breakpoint
ALTER TABLE "content_triggers" ADD COLUMN "last_file_event_at" timestamp;--> statement-breakpoint
ALTER TABLE "content_triggers" ADD COLUMN "file_watch_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "badge_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "platform_footer_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "meta_title" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "meta_description" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "og_image" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "keywords" jsonb;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "structured_data" jsonb;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "readability_score" real;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "geo_score" real;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "geo_checklist" jsonb;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "seo_analysis" jsonb;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarding_completed" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "devto_integrations" ADD CONSTRAINT "devto_integrations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devto_publications" ADD CONSTRAINT "devto_publications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devto_publications" ADD CONSTRAINT "devto_publications_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devto_publications" ADD CONSTRAINT "devto_publications_integration_id_devto_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."devto_integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_activity" ADD CONSTRAINT "workspace_activity_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_activity" ADD CONSTRAINT "workspace_activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "devtoIntegrations_workspaceId_uidx" ON "devto_integrations" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "devtoPublications_workspaceId_idx" ON "devto_publications" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "devtoPublications_postId_idx" ON "devto_publications" USING btree ("post_id");--> statement-breakpoint
CREATE UNIQUE INDEX "devtoPublications_postId_uidx" ON "devto_publications" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "workspaceActivity_workspaceId_idx" ON "workspace_activity" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspaceActivity_workspaceId_createdAt_idx" ON "workspace_activity" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "workspaceActivity_userId_idx" ON "workspace_activity" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "workspaceInvites_workspaceId_idx" ON "workspace_invites" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspaceInvites_email_idx" ON "workspace_invites" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "workspaceMembers_workspaceId_userId_uidx" ON "workspace_members" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "workspaceMembers_workspaceId_idx" ON "workspace_members" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspaceMembers_userId_idx" ON "workspace_members" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "posts_createdBy_idx" ON "posts" USING btree ("created_by");