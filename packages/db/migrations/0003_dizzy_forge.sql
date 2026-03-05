CREATE TABLE "linkedin_publications" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"post_id" text NOT NULL,
	"integration_id" text NOT NULL,
	"linkedin_post_id" text NOT NULL,
	"linkedin_url" text,
	"synced_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "twitter_publications" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"post_id" text NOT NULL,
	"integration_id" text NOT NULL,
	"tweet_id" text NOT NULL,
	"tweet_url" text,
	"published_as_thread" boolean DEFAULT false,
	"synced_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "linkedin_publications" ADD CONSTRAINT "linkedin_publications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "linkedin_publications" ADD CONSTRAINT "linkedin_publications_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "linkedin_publications" ADD CONSTRAINT "linkedin_publications_integration_id_linkedin_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."linkedin_integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "twitter_publications" ADD CONSTRAINT "twitter_publications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "twitter_publications" ADD CONSTRAINT "twitter_publications_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "twitter_publications" ADD CONSTRAINT "twitter_publications_integration_id_twitter_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."twitter_integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "linkedinPublications_workspaceId_idx" ON "linkedin_publications" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "linkedinPublications_postId_idx" ON "linkedin_publications" USING btree ("post_id");--> statement-breakpoint
CREATE UNIQUE INDEX "linkedinPublications_postId_uidx" ON "linkedin_publications" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "twitterPublications_workspaceId_idx" ON "twitter_publications" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "twitterPublications_postId_idx" ON "twitter_publications" USING btree ("post_id");--> statement-breakpoint
CREATE UNIQUE INDEX "twitterPublications_postId_uidx" ON "twitter_publications" USING btree ("post_id");