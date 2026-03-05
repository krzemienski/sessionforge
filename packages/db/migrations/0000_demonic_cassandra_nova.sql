CREATE TYPE "public"."content_type" AS ENUM('blog_post', 'twitter_thread', 'linkedin_post', 'devto_post', 'changelog', 'newsletter', 'custom');--> statement-breakpoint
CREATE TYPE "public"."insight_category" AS ENUM('novel_problem_solving', 'tool_pattern_discovery', 'before_after_transformation', 'failure_recovery', 'architecture_decision', 'performance_optimization');--> statement-breakpoint
CREATE TYPE "public"."lookback_window" AS ENUM('current_day', 'yesterday', 'last_7_days', 'last_14_days', 'last_30_days', 'custom');--> statement-breakpoint
CREATE TYPE "public"."post_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."template_type" AS ENUM('built_in', 'custom', 'workspace_default');--> statement-breakpoint
CREATE TYPE "public"."tone_profile" AS ENUM('technical', 'tutorial', 'conversational', 'professional', 'casual');--> statement-breakpoint
CREATE TYPE "public"."trigger_type" AS ENUM('manual', 'scheduled', 'file_watch');--> statement-breakpoint
CREATE TYPE "public"."workspace_member_role" AS ENUM('owner', 'editor', 'viewer');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"user_id" text NOT NULL,
	"active_workspace_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"ip_address" text,
	"user_agent" text,
	CONSTRAINT "auth_sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "claude_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"session_id" text NOT NULL,
	"project_path" text NOT NULL,
	"project_name" text NOT NULL,
	"file_path" text NOT NULL,
	"message_count" integer NOT NULL,
	"tools_used" jsonb,
	"files_modified" jsonb,
	"errors_encountered" jsonb,
	"summary" text,
	"started_at" timestamp NOT NULL,
	"ended_at" timestamp,
	"duration_seconds" integer,
	"cost_usd" real,
	"raw_metadata" jsonb,
	"scanned_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "content_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"template_type" "template_type" NOT NULL,
	"content_type" "content_type" NOT NULL,
	"description" text,
	"structure" jsonb,
	"tone_guidance" text,
	"example_content" text,
	"is_active" boolean DEFAULT true,
	"created_by" text,
	"usage_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "content_triggers" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text DEFAULT 'Untitled Schedule' NOT NULL,
	"trigger_type" "trigger_type" NOT NULL,
	"content_type" "content_type" NOT NULL,
	"lookback_window" "lookback_window" DEFAULT 'last_7_days',
	"cron_expression" text,
	"qstash_schedule_id" text,
	"enabled" boolean DEFAULT true,
	"last_run_at" timestamp,
	"last_run_status" text,
	"debounce_minutes" integer DEFAULT 30,
	"watch_status" text,
	"last_file_event_at" timestamp,
	"file_watch_snapshot" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
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
CREATE TABLE "github_commits" (
	"id" text PRIMARY KEY NOT NULL,
	"repository_id" text NOT NULL,
	"commit_sha" text NOT NULL,
	"message" text NOT NULL,
	"author_name" text,
	"author_email" text,
	"author_date" timestamp NOT NULL,
	"commit_url" text NOT NULL,
	"additions" integer,
	"deletions" integer,
	"files_changed" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "github_integrations" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"access_token" text NOT NULL,
	"github_username" text,
	"enabled" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "github_issues" (
	"id" text PRIMARY KEY NOT NULL,
	"repository_id" text NOT NULL,
	"issue_number" integer NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"state" text NOT NULL,
	"author_name" text,
	"issue_url" text NOT NULL,
	"created_at_github" timestamp NOT NULL,
	"closed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "github_privacy_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"repository_id" text,
	"commit_sha" text,
	"exclude_from_content" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "github_pull_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"repository_id" text NOT NULL,
	"pr_number" integer NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"state" text NOT NULL,
	"author_name" text,
	"pr_url" text NOT NULL,
	"merged_at" timestamp,
	"created_at_github" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "github_repositories" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"integration_id" text NOT NULL,
	"github_repo_id" integer NOT NULL,
	"repo_name" text NOT NULL,
	"repo_url" text NOT NULL,
	"default_branch" text DEFAULT 'main',
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "insights" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"session_id" text,
	"category" "insight_category" NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"code_snippets" jsonb,
	"terminal_output" jsonb,
	"composite_score" real NOT NULL,
	"novelty_score" real DEFAULT 0,
	"tool_pattern_score" real DEFAULT 0,
	"transformation_score" real DEFAULT 0,
	"failure_recovery_score" real DEFAULT 0,
	"reproducibility_score" real DEFAULT 0,
	"scale_score" real DEFAULT 0,
	"used_in_content" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"markdown" text NOT NULL,
	"content_type" "content_type" NOT NULL,
	"status" "post_status" DEFAULT 'draft',
	"insight_id" text,
	"source_metadata" jsonb,
	"tone_used" "tone_profile",
	"word_count" integer,
	"ai_draft_markdown" text,
	"edit_distance" integer,
	"style_profile_used" text,
	"badge_enabled" boolean DEFAULT false,
	"platform_footer_enabled" boolean DEFAULT false,
	"created_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "style_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"default_tone" "tone_profile" DEFAULT 'technical',
	"target_audience" text DEFAULT 'senior engineers',
	"custom_instructions" text,
	"include_code_snippets" boolean DEFAULT true,
	"include_terminal_output" boolean DEFAULT true,
	"max_blog_word_count" integer DEFAULT 2500,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false,
	"onboarding_completed" boolean DEFAULT false,
	"image" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
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
CREATE TABLE "workspaces" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"owner_id" text NOT NULL,
	"session_base_path" text DEFAULT '~/.claude',
	"last_scan_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "workspaces_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claude_sessions" ADD CONSTRAINT "claude_sessions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_templates" ADD CONSTRAINT "content_templates_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_templates" ADD CONSTRAINT "content_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_triggers" ADD CONSTRAINT "content_triggers_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devto_integrations" ADD CONSTRAINT "devto_integrations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devto_publications" ADD CONSTRAINT "devto_publications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devto_publications" ADD CONSTRAINT "devto_publications_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devto_publications" ADD CONSTRAINT "devto_publications_integration_id_devto_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."devto_integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_commits" ADD CONSTRAINT "github_commits_repository_id_github_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."github_repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_integrations" ADD CONSTRAINT "github_integrations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_issues" ADD CONSTRAINT "github_issues_repository_id_github_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."github_repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_privacy_settings" ADD CONSTRAINT "github_privacy_settings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_privacy_settings" ADD CONSTRAINT "github_privacy_settings_repository_id_github_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."github_repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_pull_requests" ADD CONSTRAINT "github_pull_requests_repository_id_github_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."github_repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_repositories" ADD CONSTRAINT "github_repositories_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_repositories" ADD CONSTRAINT "github_repositories_integration_id_github_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."github_integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insights" ADD CONSTRAINT "insights_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insights" ADD CONSTRAINT "insights_session_id_claude_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."claude_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_insight_id_insights_id_fk" FOREIGN KEY ("insight_id") REFERENCES "public"."insights"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "style_settings" ADD CONSTRAINT "style_settings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_activity" ADD CONSTRAINT "workspace_activity_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_activity" ADD CONSTRAINT "workspace_activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_userId_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "apiKeys_workspaceId_idx" ON "api_keys" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "auth_sessions_userId_idx" ON "auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_workspaceId_idx" ON "claude_sessions" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "sessions_startedAt_idx" ON "claude_sessions" USING btree ("started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_workspace_sessionId_uidx" ON "claude_sessions" USING btree ("workspace_id","session_id");--> statement-breakpoint
CREATE INDEX "contentTemplates_workspaceId_idx" ON "content_templates" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "contentTemplates_templateType_idx" ON "content_templates" USING btree ("template_type");--> statement-breakpoint
CREATE UNIQUE INDEX "contentTemplates_slug_uidx" ON "content_templates" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "triggers_workspaceId_idx" ON "content_triggers" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "devtoIntegrations_workspaceId_uidx" ON "devto_integrations" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "devtoPublications_workspaceId_idx" ON "devto_publications" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "devtoPublications_postId_idx" ON "devto_publications" USING btree ("post_id");--> statement-breakpoint
CREATE UNIQUE INDEX "devtoPublications_postId_uidx" ON "devto_publications" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "githubCommits_repositoryId_idx" ON "github_commits" USING btree ("repository_id");--> statement-breakpoint
CREATE INDEX "githubCommits_authorDate_idx" ON "github_commits" USING btree ("author_date");--> statement-breakpoint
CREATE UNIQUE INDEX "githubCommits_repositoryId_commitSha_uidx" ON "github_commits" USING btree ("repository_id","commit_sha");--> statement-breakpoint
CREATE UNIQUE INDEX "githubIntegrations_workspaceId_uidx" ON "github_integrations" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "githubIssues_repositoryId_idx" ON "github_issues" USING btree ("repository_id");--> statement-breakpoint
CREATE INDEX "githubIssues_createdAtGithub_idx" ON "github_issues" USING btree ("created_at_github");--> statement-breakpoint
CREATE UNIQUE INDEX "githubIssues_repositoryId_issueNumber_uidx" ON "github_issues" USING btree ("repository_id","issue_number");--> statement-breakpoint
CREATE INDEX "githubPrivacySettings_workspaceId_idx" ON "github_privacy_settings" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "githubPrivacySettings_repositoryId_idx" ON "github_privacy_settings" USING btree ("repository_id");--> statement-breakpoint
CREATE INDEX "githubPullRequests_repositoryId_idx" ON "github_pull_requests" USING btree ("repository_id");--> statement-breakpoint
CREATE INDEX "githubPullRequests_createdAtGithub_idx" ON "github_pull_requests" USING btree ("created_at_github");--> statement-breakpoint
CREATE UNIQUE INDEX "githubPullRequests_repositoryId_prNumber_uidx" ON "github_pull_requests" USING btree ("repository_id","pr_number");--> statement-breakpoint
CREATE INDEX "githubRepositories_workspaceId_idx" ON "github_repositories" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "githubRepositories_integrationId_idx" ON "github_repositories" USING btree ("integration_id");--> statement-breakpoint
CREATE UNIQUE INDEX "githubRepositories_workspaceId_githubRepoId_uidx" ON "github_repositories" USING btree ("workspace_id","github_repo_id");--> statement-breakpoint
CREATE INDEX "insights_workspaceId_idx" ON "insights" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "insights_compositeScore_idx" ON "insights" USING btree ("composite_score");--> statement-breakpoint
CREATE INDEX "posts_workspaceId_createdAt_idx" ON "posts" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "posts_createdBy_idx" ON "posts" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "styleSettings_workspaceId_uidx" ON "style_settings" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspaceActivity_workspaceId_idx" ON "workspace_activity" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspaceActivity_workspaceId_createdAt_idx" ON "workspace_activity" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "workspaceActivity_userId_idx" ON "workspace_activity" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "workspaceInvites_workspaceId_idx" ON "workspace_invites" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspaceInvites_email_idx" ON "workspace_invites" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "workspaceMembers_workspaceId_userId_uidx" ON "workspace_members" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "workspaceMembers_workspaceId_idx" ON "workspace_members" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspaceMembers_userId_idx" ON "workspace_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_slug_uidx" ON "workspaces" USING btree ("slug");