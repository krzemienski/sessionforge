CREATE TYPE "public"."content_type" AS ENUM('blog_post', 'twitter_thread', 'linkedin_post', 'devto_post', 'changelog', 'newsletter', 'custom');--> statement-breakpoint
CREATE TYPE "public"."insight_category" AS ENUM('novel_problem_solving', 'tool_pattern_discovery', 'before_after_transformation', 'failure_recovery', 'architecture_decision', 'performance_optimization');--> statement-breakpoint
CREATE TYPE "public"."lookback_window" AS ENUM('current_day', 'yesterday', 'last_7_days', 'last_14_days', 'last_30_days', 'custom');--> statement-breakpoint
CREATE TYPE "public"."post_status" AS ENUM('idea', 'draft', 'in_review', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."tone_profile" AS ENUM('technical', 'tutorial', 'conversational', 'professional', 'casual');--> statement-breakpoint
CREATE TYPE "public"."trigger_type" AS ENUM('manual', 'scheduled', 'file_watch');--> statement-breakpoint
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
	"published_at" timestamp,
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
CREATE TABLE "workspaces" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"owner_id" text NOT NULL,
	"session_base_path" text DEFAULT '~/.claude',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "workspaces_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claude_sessions" ADD CONSTRAINT "claude_sessions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_triggers" ADD CONSTRAINT "content_triggers_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insights" ADD CONSTRAINT "insights_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insights" ADD CONSTRAINT "insights_session_id_claude_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."claude_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_insight_id_insights_id_fk" FOREIGN KEY ("insight_id") REFERENCES "public"."insights"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "style_settings" ADD CONSTRAINT "style_settings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_userId_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "apiKeys_workspaceId_idx" ON "api_keys" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "auth_sessions_userId_idx" ON "auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_workspaceId_idx" ON "claude_sessions" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "sessions_startedAt_idx" ON "claude_sessions" USING btree ("started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_workspace_sessionId_uidx" ON "claude_sessions" USING btree ("workspace_id","session_id");--> statement-breakpoint
CREATE INDEX "triggers_workspaceId_idx" ON "content_triggers" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "insights_workspaceId_idx" ON "insights" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "insights_compositeScore_idx" ON "insights" USING btree ("composite_score");--> statement-breakpoint
CREATE INDEX "posts_workspaceId_createdAt_idx" ON "posts" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "styleSettings_workspaceId_uidx" ON "style_settings" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_slug_uidx" ON "workspaces" USING btree ("slug");