CREATE TYPE "public"."agent_run_status" AS ENUM('running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."agent_type" AS ENUM('insight-extractor', 'blog-writer', 'social-writer', 'changelog-writer', 'editor-chat');--> statement-breakpoint
CREATE TYPE "public"."approval_decision_type" AS ENUM('approved', 'rejected', 'changes_requested');--> statement-breakpoint
CREATE TYPE "public"."automation_run_status" AS ENUM('pending', 'scanning', 'extracting', 'generating', 'complete', 'failed');--> statement-breakpoint
CREATE TYPE "public"."backup_bundle_format" AS ENUM('json', 'zip');--> statement-breakpoint
CREATE TYPE "public"."backup_bundle_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."batch_job_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."batch_job_type" AS ENUM('extract_insights', 'generate_content', 'batch_archive', 'batch_delete', 'backup_bundle', 'restore_bundle');--> statement-breakpoint
CREATE TYPE "public"."content_asset_type" AS ENUM('diagram', 'hero_image', 'section_image', 'evidence_diagram', 'timeline_viz');--> statement-breakpoint
CREATE TYPE "public"."content_type" AS ENUM('blog_post', 'twitter_thread', 'linkedin_post', 'devto_post', 'changelog', 'newsletter', 'custom', 'doc_page');--> statement-breakpoint
CREATE TYPE "public"."edit_type" AS ENUM('user_edit', 'ai_generated', 'auto_save', 'restore');--> statement-breakpoint
CREATE TYPE "public"."experiment_kpi" AS ENUM('views', 'likes', 'comments', 'shares', 'engagement_rate');--> statement-breakpoint
CREATE TYPE "public"."experiment_status" AS ENUM('draft', 'running', 'paused', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."feedback_action" AS ENUM('accepted', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."insight_category" AS ENUM('novel_problem_solving', 'tool_pattern_discovery', 'before_after_transformation', 'failure_recovery', 'architecture_decision', 'performance_optimization');--> statement-breakpoint
CREATE TYPE "public"."integration_health_status" AS ENUM('healthy', 'degraded', 'unhealthy', 'paused');--> statement-breakpoint
CREATE TYPE "public"."integration_platform" AS ENUM('devto', 'ghost', 'medium', 'twitter', 'linkedin', 'wordpress');--> statement-breakpoint
CREATE TYPE "public"."lookback_window" AS ENUM('current_day', 'yesterday', 'last_7_days', 'last_14_days', 'last_30_days', 'last_90_days', 'all_time', 'custom');--> statement-breakpoint
CREATE TYPE "public"."metrics_platform" AS ENUM('devto', 'hashnode', 'manual');--> statement-breakpoint
CREATE TYPE "public"."pipeline_source" AS ENUM('manual', 'trigger', 'scheduled');--> statement-breakpoint
CREATE TYPE "public"."plan_tier" AS ENUM('free', 'solo', 'pro', 'team');--> statement-breakpoint
CREATE TYPE "public"."portfolio_theme" AS ENUM('minimal', 'developer-dark', 'colorful');--> statement-breakpoint
CREATE TYPE "public"."post_status" AS ENUM('draft', 'published', 'archived', 'idea', 'in_review', 'scheduled', 'approved');--> statement-breakpoint
CREATE TYPE "public"."recommendation_type" AS ENUM('topic', 'format', 'length', 'keyword', 'improvement');--> statement-breakpoint
CREATE TYPE "public"."research_item_type" AS ENUM('link', 'note', 'code_snippet', 'session_snippet');--> statement-breakpoint
CREATE TYPE "public"."risk_category" AS ENUM('unsupported_claim', 'outdated_info', 'version_specific', 'subjective_opinion', 'unverified_metric');--> statement-breakpoint
CREATE TYPE "public"."risk_flag_status" AS ENUM('unresolved', 'verified', 'dismissed', 'overridden');--> statement-breakpoint
CREATE TYPE "public"."risk_severity" AS ENUM('critical', 'high', 'medium', 'low', 'info');--> statement-breakpoint
CREATE TYPE "public"."scheduled_publication_status" AS ENUM('pending', 'publishing', 'published', 'failed', 'retry_exhausted', 'paused');--> statement-breakpoint
CREATE TYPE "public"."site_theme" AS ENUM('minimal-portfolio', 'technical-blog', 'changelog');--> statement-breakpoint
CREATE TYPE "public"."social_platform" AS ENUM('twitter', 'linkedin');--> statement-breakpoint
CREATE TYPE "public"."style_profile_generation_status" AS ENUM('pending', 'generating', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'canceled', 'past_due', 'trialing', 'incomplete', 'incomplete_expired');--> statement-breakpoint
CREATE TYPE "public"."supplementary_type" AS ENUM('twitter_thread', 'linkedin_post', 'newsletter_excerpt', 'executive_summary', 'pull_quotes', 'slide_outline', 'evidence_highlights');--> statement-breakpoint
CREATE TYPE "public"."template_type" AS ENUM('built_in', 'custom', 'workspace_default');--> statement-breakpoint
CREATE TYPE "public"."tone_profile" AS ENUM('technical', 'tutorial', 'conversational', 'professional', 'casual');--> statement-breakpoint
CREATE TYPE "public"."trigger_type" AS ENUM('manual', 'scheduled', 'file_watch');--> statement-breakpoint
CREATE TYPE "public"."usage_event_type" AS ENUM('session_scan', 'insight_extraction', 'content_generation');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('unverified', 'pending', 'verified', 'has_issues');--> statement-breakpoint
CREATE TYPE "public"."version_type" AS ENUM('major', 'minor');--> statement-breakpoint
CREATE TYPE "public"."workspace_member_role" AS ENUM('owner', 'editor', 'viewer', 'reviewer', 'publisher', 'analyst');--> statement-breakpoint
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
CREATE TABLE "agent_events" (
	"id" text PRIMARY KEY NOT NULL,
	"trace_id" text NOT NULL,
	"parent_event_id" text,
	"workspace_id" text NOT NULL,
	"agent_type" text NOT NULL,
	"agent_run_id" text,
	"event_type" text NOT NULL,
	"level" text DEFAULT 'info' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"agent_type" "agent_type" NOT NULL,
	"status" "agent_run_status" DEFAULT 'running',
	"attempt_count" integer DEFAULT 0,
	"error_message" text,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"input_metadata" jsonb,
	"result_metadata" jsonb
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
CREATE TABLE "approval_decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" text NOT NULL,
	"reviewer_id" text NOT NULL,
	"decision" "approval_decision_type" NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "approval_workflows" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"enabled" boolean DEFAULT false,
	"required_approvers" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
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
CREATE TABLE "automation_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"trigger_id" text,
	"workspace_id" text NOT NULL,
	"source" "pipeline_source" DEFAULT 'trigger' NOT NULL,
	"status" "automation_run_status" DEFAULT 'pending' NOT NULL,
	"sessions_scanned" integer DEFAULT 0 NOT NULL,
	"insights_extracted" integer DEFAULT 0 NOT NULL,
	"post_id" text,
	"error_message" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"duration_ms" integer
);
--> statement-breakpoint
CREATE TABLE "backup_bundles" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"created_by" text NOT NULL,
	"status" "backup_bundle_status" DEFAULT 'pending' NOT NULL,
	"post_count" integer DEFAULT 0 NOT NULL,
	"series_count" integer DEFAULT 0 NOT NULL,
	"file_size_bytes" integer,
	"bundle_format" "backup_bundle_format" DEFAULT 'zip' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "batch_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"type" "batch_job_type" NOT NULL,
	"status" "batch_job_status" DEFAULT 'pending' NOT NULL,
	"total_items" integer DEFAULT 0 NOT NULL,
	"processed_items" integer DEFAULT 0 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"created_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"completed_at" timestamp
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
CREATE TABLE "collection_posts" (
	"id" text PRIMARY KEY NOT NULL,
	"collection_id" text NOT NULL,
	"post_id" text NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"title" text NOT NULL,
	"name" text,
	"description" text,
	"slug" text NOT NULL,
	"cover_image" text,
	"is_public" boolean DEFAULT false,
	"theme" "site_theme" DEFAULT 'technical-blog',
	"custom_domain" text,
	"powered_by_footer" boolean DEFAULT true,
	"created_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "content_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"asset_type" "content_asset_type" NOT NULL,
	"content" text NOT NULL,
	"alt_text" text,
	"caption" text,
	"placement" jsonb DEFAULT '{}'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_metrics" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"post_id" text,
	"platform" "metrics_platform" NOT NULL,
	"external_id" text,
	"title" text NOT NULL,
	"url" text,
	"views" integer DEFAULT 0,
	"reactions" integer DEFAULT 0,
	"comments" integer DEFAULT 0,
	"likes" integer DEFAULT 0,
	"published_at" timestamp,
	"fetched_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "content_recommendations" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"recommendation_type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"reasoning" text NOT NULL,
	"supporting_data" jsonb,
	"confidence_score" real,
	"helpful_rating" boolean,
	"suggested_content_type" "content_type",
	"suggested_publish_time" timestamp,
	"insight_id" text,
	"priority" integer DEFAULT 0,
	"status" text DEFAULT 'active' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
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
	"health_status" "integration_health_status" DEFAULT 'healthy',
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
CREATE TABLE "experiment_results" (
	"id" text PRIMARY KEY NOT NULL,
	"variant_id" text NOT NULL,
	"impressions" integer DEFAULT 0,
	"clicks" integer DEFAULT 0,
	"views" integer DEFAULT 0,
	"likes" integer DEFAULT 0,
	"comments" integer DEFAULT 0,
	"shares" integer DEFAULT 0,
	"engagement_rate" real DEFAULT 0,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "experiment_variants" (
	"id" text PRIMARY KEY NOT NULL,
	"experiment_id" text NOT NULL,
	"label" text NOT NULL,
	"headline_text" text NOT NULL,
	"hook_text" text NOT NULL,
	"traffic_allocation" real NOT NULL,
	"is_control" boolean DEFAULT false,
	"is_winner" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "experiments" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"post_id" text NOT NULL,
	"name" text NOT NULL,
	"kpi" "experiment_kpi" NOT NULL,
	"status" "experiment_status" DEFAULT 'draft',
	"starts_at" timestamp,
	"ends_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ghost_integrations" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"ghost_url" text NOT NULL,
	"admin_api_key" text NOT NULL,
	"enabled" boolean DEFAULT true,
	"health_status" "integration_health_status" DEFAULT 'healthy',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ghost_publications" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"post_id" text NOT NULL,
	"integration_id" text NOT NULL,
	"ghost_post_id" text NOT NULL,
	"ghost_url" text,
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
CREATE TABLE "integration_health_checks" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"platform" "integration_platform" NOT NULL,
	"status" "integration_health_status" DEFAULT 'healthy' NOT NULL,
	"last_checked_at" timestamp DEFAULT now(),
	"error_message" text,
	"error_code" text,
	"response_time_ms" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "integration_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"hashnode_api_token" text,
	"hashnode_publication_id" text,
	"hashnode_default_canonical_domain" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "linkedin_integrations" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"access_token_expires_at" timestamp,
	"linkedin_user_id" text,
	"username" text,
	"enabled" boolean DEFAULT true,
	"health_status" "integration_health_status" DEFAULT 'healthy',
	"last_sync_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
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
CREATE TABLE "medium_integrations" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"api_key" text NOT NULL,
	"username" text,
	"medium_user_id" text,
	"enabled" boolean DEFAULT true,
	"health_status" "integration_health_status" DEFAULT 'healthy',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "medium_publications" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"post_id" text NOT NULL,
	"integration_id" text NOT NULL,
	"medium_article_id" text NOT NULL,
	"medium_url" text,
	"published_as_draft" boolean DEFAULT false,
	"synced_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "onboarding_funnel_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"step" text NOT NULL,
	"event" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"devto_api_key" text,
	"devto_username" text,
	"hashnode_api_key" text,
	"hashnode_username" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "portfolio_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"is_enabled" boolean DEFAULT false,
	"bio" text,
	"avatar_url" text,
	"social_links" jsonb,
	"pinned_post_ids" jsonb,
	"theme" "portfolio_theme" DEFAULT 'minimal',
	"custom_domain" text,
	"show_rss" boolean DEFAULT true,
	"show_powered_by" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "post_conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"messages" jsonb DEFAULT '[]'::jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "post_reviewers" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" text NOT NULL,
	"user_id" text NOT NULL,
	"assigned_by" text,
	"assigned_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "post_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" text NOT NULL,
	"version_number" integer NOT NULL,
	"version_type" "version_type" NOT NULL,
	"edit_type" "edit_type" NOT NULL,
	"content_snapshot" text,
	"content_diff" jsonb,
	"parent_revision_id" text,
	"title" text NOT NULL,
	"word_count" integer DEFAULT 0,
	"word_count_delta" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"created_by" text,
	"version_label" text,
	"version_notes" text
);
--> statement-breakpoint
CREATE TABLE "post_style_metrics" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"readability_score" real,
	"grade_level" real,
	"word_count" integer,
	"sentence_count" integer,
	"avg_sentence_length" real,
	"avg_syllables_per_word" real,
	"vocab_diversity" real,
	"passive_voice_pct" real,
	"code_to_prose_ratio" real,
	"ai_pattern_count" integer,
	"ai_pattern_matches" jsonb,
	"authenticity_score" real,
	"voice_consistency_score" real,
	"suggestions" jsonb,
	"analyzed_at" timestamp DEFAULT now()
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
	"parent_post_id" text,
	"source_metadata" jsonb,
	"tone_used" "tone_profile",
	"word_count" integer,
	"ai_draft_markdown" text,
	"edit_distance" integer,
	"style_profile_used" text,
	"badge_enabled" boolean DEFAULT false,
	"platform_footer_enabled" boolean DEFAULT false,
	"hashnode_url" text,
	"wordpress_published_url" text,
	"wordpress_post_id" text,
	"seo_metadata" jsonb,
	"meta_title" text,
	"meta_description" text,
	"og_image" text,
	"keywords" jsonb,
	"structured_data" jsonb,
	"readability_score" real,
	"geo_score" real,
	"geo_checklist" jsonb,
	"seo_analysis" jsonb,
	"citations" jsonb,
	"verification_status" "verification_status" DEFAULT 'unverified',
	"risk_flags" jsonb,
	"created_by" text,
	"published_at" timestamp,
	"scheduled_for" timestamp,
	"timezone" text,
	"qstash_schedule_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "recommendation_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"recommendation_id" text NOT NULL,
	"user_id" text NOT NULL,
	"action" "feedback_action" NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "research_items" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"type" "research_item_type" NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"url" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"credibility_rating" integer,
	"session_id" text,
	"message_index" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "risk_flag_resolutions" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" text NOT NULL,
	"flag_id" text NOT NULL,
	"status" "risk_flag_status" NOT NULL,
	"resolved_by" text,
	"evidence_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "scan_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"label" text NOT NULL,
	"host" text NOT NULL,
	"port" integer DEFAULT 22,
	"username" text NOT NULL,
	"encrypted_password" text NOT NULL,
	"base_path" text DEFAULT '~/.claude',
	"enabled" boolean DEFAULT true,
	"last_scanned_at" timestamp,
	"host_fingerprint" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
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
CREATE TABLE "series" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"slug" text NOT NULL,
	"cover_image" text,
	"is_public" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "series_posts" (
	"id" text PRIMARY KEY NOT NULL,
	"series_id" text NOT NULL,
	"post_id" text NOT NULL,
	"order" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "session_bookmarks" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"session_id" text NOT NULL,
	"message_index" integer NOT NULL,
	"label" text NOT NULL,
	"note" text,
	"sent_to_insights" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
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
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"plan_tier" "plan_tier" DEFAULT 'free' NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "supplementary_content" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"content_type" "supplementary_type" NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "twitter_integrations" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"access_token_expires_at" timestamp,
	"twitter_user_id" text,
	"username" text,
	"enabled" boolean DEFAULT true,
	"health_status" "integration_health_status" DEFAULT 'healthy',
	"last_sync_at" timestamp,
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
CREATE TABLE "usage_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"event_type" "usage_event_type" NOT NULL,
	"cost_usd" real DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "usage_monthly_summary" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"month" text NOT NULL,
	"session_scans" integer DEFAULT 0 NOT NULL,
	"insight_extractions" integer DEFAULT 0 NOT NULL,
	"content_generations" integer DEFAULT 0 NOT NULL,
	"estimated_cost_usd" real DEFAULT 0 NOT NULL,
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
CREATE TABLE "webhook_endpoints" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"url" text NOT NULL,
	"events" jsonb NOT NULL,
	"secret" text NOT NULL,
	"enabled" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "wordpress_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"site_url" text NOT NULL,
	"username" text NOT NULL,
	"encrypted_app_password" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"health_status" "integration_health_status" DEFAULT 'healthy',
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
	"custom_permissions" jsonb,
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
CREATE TABLE "writing_skills" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"instructions" text NOT NULL,
	"applies_to" jsonb,
	"enabled" boolean DEFAULT true,
	"source" text NOT NULL,
	"file_path" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "writing_style_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text DEFAULT 'Default Style' NOT NULL,
	"description" text,
	"voice_characteristics" jsonb,
	"tone_attributes" jsonb,
	"vocabulary_level" text,
	"sentence_structure" text,
	"example_excerpts" jsonb,
	"generation_status" "style_profile_generation_status" DEFAULT 'pending',
	"generated_at" timestamp,
	"custom_instructions" text,
	"vocabulary_fingerprint" jsonb,
	"anti_ai_patterns" jsonb,
	"calibrated_from_samples" boolean DEFAULT false,
	"formality_override" real,
	"humor_override" real,
	"technical_depth_override" real,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_events" ADD CONSTRAINT "agent_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_workflows" ADD CONSTRAINT "approval_workflows_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_trigger_id_content_triggers_id_fk" FOREIGN KEY ("trigger_id") REFERENCES "public"."content_triggers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backup_bundles" ADD CONSTRAINT "backup_bundles_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backup_bundles" ADD CONSTRAINT "backup_bundles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_jobs" ADD CONSTRAINT "batch_jobs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_jobs" ADD CONSTRAINT "batch_jobs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claude_sessions" ADD CONSTRAINT "claude_sessions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_posts" ADD CONSTRAINT "collection_posts_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_posts" ADD CONSTRAINT "collection_posts_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_assets" ADD CONSTRAINT "content_assets_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_assets" ADD CONSTRAINT "content_assets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_metrics" ADD CONSTRAINT "content_metrics_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_metrics" ADD CONSTRAINT "content_metrics_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_recommendations" ADD CONSTRAINT "content_recommendations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_recommendations" ADD CONSTRAINT "content_recommendations_insight_id_insights_id_fk" FOREIGN KEY ("insight_id") REFERENCES "public"."insights"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_templates" ADD CONSTRAINT "content_templates_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_templates" ADD CONSTRAINT "content_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_triggers" ADD CONSTRAINT "content_triggers_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devto_integrations" ADD CONSTRAINT "devto_integrations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devto_publications" ADD CONSTRAINT "devto_publications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devto_publications" ADD CONSTRAINT "devto_publications_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devto_publications" ADD CONSTRAINT "devto_publications_integration_id_devto_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."devto_integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_metrics" ADD CONSTRAINT "engagement_metrics_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_metrics" ADD CONSTRAINT "engagement_metrics_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_results" ADD CONSTRAINT "experiment_results_variant_id_experiment_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."experiment_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_variants" ADD CONSTRAINT "experiment_variants_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ghost_integrations" ADD CONSTRAINT "ghost_integrations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ghost_publications" ADD CONSTRAINT "ghost_publications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ghost_publications" ADD CONSTRAINT "ghost_publications_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ghost_publications" ADD CONSTRAINT "ghost_publications_integration_id_ghost_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."ghost_integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "integration_health_checks" ADD CONSTRAINT "integration_health_checks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_settings" ADD CONSTRAINT "integration_settings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "linkedin_integrations" ADD CONSTRAINT "linkedin_integrations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "linkedin_publications" ADD CONSTRAINT "linkedin_publications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "linkedin_publications" ADD CONSTRAINT "linkedin_publications_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "linkedin_publications" ADD CONSTRAINT "linkedin_publications_integration_id_linkedin_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."linkedin_integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medium_integrations" ADD CONSTRAINT "medium_integrations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medium_publications" ADD CONSTRAINT "medium_publications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medium_publications" ADD CONSTRAINT "medium_publications_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medium_publications" ADD CONSTRAINT "medium_publications_integration_id_medium_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."medium_integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_funnel_events" ADD CONSTRAINT "onboarding_funnel_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_settings" ADD CONSTRAINT "portfolio_settings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_conversations" ADD CONSTRAINT "post_conversations_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_conversations" ADD CONSTRAINT "post_conversations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_performance_metrics" ADD CONSTRAINT "post_performance_metrics_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_reviewers" ADD CONSTRAINT "post_reviewers_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_reviewers" ADD CONSTRAINT "post_reviewers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_reviewers" ADD CONSTRAINT "post_reviewers_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_revisions" ADD CONSTRAINT "post_revisions_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_style_metrics" ADD CONSTRAINT "post_style_metrics_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_style_metrics" ADD CONSTRAINT "post_style_metrics_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_insight_id_insights_id_fk" FOREIGN KEY ("insight_id") REFERENCES "public"."insights"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_feedback" ADD CONSTRAINT "recommendation_feedback_recommendation_id_content_recommendations_id_fk" FOREIGN KEY ("recommendation_id") REFERENCES "public"."content_recommendations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_feedback" ADD CONSTRAINT "recommendation_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_items" ADD CONSTRAINT "research_items_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_items" ADD CONSTRAINT "research_items_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_items" ADD CONSTRAINT "research_items_session_id_claude_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."claude_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_flag_resolutions" ADD CONSTRAINT "risk_flag_resolutions_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_flag_resolutions" ADD CONSTRAINT "risk_flag_resolutions_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_sources" ADD CONSTRAINT "scan_sources_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_publications" ADD CONSTRAINT "scheduled_publications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_publications" ADD CONSTRAINT "scheduled_publications_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series" ADD CONSTRAINT "series_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series_posts" ADD CONSTRAINT "series_posts_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series_posts" ADD CONSTRAINT "series_posts_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_bookmarks" ADD CONSTRAINT "session_bookmarks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_bookmarks" ADD CONSTRAINT "session_bookmarks_session_id_claude_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."claude_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_analytics" ADD CONSTRAINT "social_analytics_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_analytics" ADD CONSTRAINT "social_analytics_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "style_settings" ADD CONSTRAINT "style_settings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplementary_content" ADD CONSTRAINT "supplementary_content_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplementary_content" ADD CONSTRAINT "supplementary_content_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "twitter_integrations" ADD CONSTRAINT "twitter_integrations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "twitter_publications" ADD CONSTRAINT "twitter_publications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "twitter_publications" ADD CONSTRAINT "twitter_publications_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "twitter_publications" ADD CONSTRAINT "twitter_publications_integration_id_twitter_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."twitter_integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_monthly_summary" ADD CONSTRAINT "usage_monthly_summary_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wordpress_connections" ADD CONSTRAINT "wordpress_connections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_activity" ADD CONSTRAINT "workspace_activity_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_activity" ADD CONSTRAINT "workspace_activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "writing_skills" ADD CONSTRAINT "writing_skills_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "writing_style_profiles" ADD CONSTRAINT "writing_style_profiles_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_userId_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agentEvents_traceId_idx" ON "agent_events" USING btree ("trace_id");--> statement-breakpoint
CREATE INDEX "agentEvents_workspace_time_idx" ON "agent_events" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "agentEvents_eventType_idx" ON "agent_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "agentRuns_workspaceId_idx" ON "agent_runs" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "apiKeys_workspaceId_idx" ON "api_keys" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "approvalDecisions_postId_idx" ON "approval_decisions" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "approvalDecisions_reviewerId_idx" ON "approval_decisions" USING btree ("reviewer_id");--> statement-breakpoint
CREATE INDEX "approvalDecisions_postId_createdAt_idx" ON "approval_decisions" USING btree ("post_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "approvalWorkflows_workspaceId_uidx" ON "approval_workflows" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "auth_sessions_userId_idx" ON "auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "automationRuns_workspaceId_idx" ON "automation_runs" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "automationRuns_triggerId_idx" ON "automation_runs" USING btree ("trigger_id");--> statement-breakpoint
CREATE INDEX "automationRuns_startedAt_idx" ON "automation_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "backupBundles_workspaceId_idx" ON "backup_bundles" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "backupBundles_createdBy_idx" ON "backup_bundles" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "backupBundles_status_idx" ON "backup_bundles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "batchJobs_workspaceId_idx" ON "batch_jobs" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "batchJobs_status_idx" ON "batch_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "batchJobs_createdBy_idx" ON "batch_jobs" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "sessions_workspaceId_idx" ON "claude_sessions" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "sessions_startedAt_idx" ON "claude_sessions" USING btree ("started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_workspace_sessionId_uidx" ON "claude_sessions" USING btree ("workspace_id","session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "collectionPosts_collectionId_postId_uidx" ON "collection_posts" USING btree ("collection_id","post_id");--> statement-breakpoint
CREATE INDEX "collectionPosts_collectionId_idx" ON "collection_posts" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "collectionPosts_collectionId_order_idx" ON "collection_posts" USING btree ("collection_id","order");--> statement-breakpoint
CREATE UNIQUE INDEX "collections_workspaceId_slug_uidx" ON "collections" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE INDEX "collections_workspaceId_idx" ON "collections" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "contentMetrics_workspaceId_idx" ON "content_metrics" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "contentMetrics_fetchedAt_idx" ON "content_metrics" USING btree ("fetched_at");--> statement-breakpoint
CREATE INDEX "contentMetrics_platform_idx" ON "content_metrics" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "contentRecommendations_workspaceId_idx" ON "content_recommendations" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "contentRecommendations_confidenceScore_idx" ON "content_recommendations" USING btree ("confidence_score");--> statement-breakpoint
CREATE INDEX "contentTemplates_workspaceId_idx" ON "content_templates" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "contentTemplates_templateType_idx" ON "content_templates" USING btree ("template_type");--> statement-breakpoint
CREATE UNIQUE INDEX "contentTemplates_slug_uidx" ON "content_templates" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "triggers_workspaceId_idx" ON "content_triggers" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "devtoIntegrations_workspaceId_uidx" ON "devto_integrations" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "devtoPublications_workspaceId_idx" ON "devto_publications" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "devtoPublications_postId_idx" ON "devto_publications" USING btree ("post_id");--> statement-breakpoint
CREATE UNIQUE INDEX "devtoPublications_postId_uidx" ON "devto_publications" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "engagementMetrics_workspaceId_idx" ON "engagement_metrics" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "engagementMetrics_postId_idx" ON "engagement_metrics" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "engagementMetrics_publishedAt_idx" ON "engagement_metrics" USING btree ("published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "engagementMetrics_postId_uidx" ON "engagement_metrics" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "experiment_results_variantId_idx" ON "experiment_results" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "experiment_results_recordedAt_idx" ON "experiment_results" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX "experiment_variants_experimentId_idx" ON "experiment_variants" USING btree ("experiment_id");--> statement-breakpoint
CREATE INDEX "experiments_workspaceId_idx" ON "experiments" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "experiments_postId_idx" ON "experiments" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "experiments_status_idx" ON "experiments" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "ghostIntegrations_workspaceId_uidx" ON "ghost_integrations" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "ghostPublications_workspaceId_idx" ON "ghost_publications" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "ghostPublications_postId_idx" ON "ghost_publications" USING btree ("post_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ghostPublications_postId_uidx" ON "ghost_publications" USING btree ("post_id");--> statement-breakpoint
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
CREATE UNIQUE INDEX "integrationHealthChecks_workspace_platform_uidx" ON "integration_health_checks" USING btree ("workspace_id","platform");--> statement-breakpoint
CREATE INDEX "integrationHealthChecks_workspaceId_idx" ON "integration_health_checks" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "integrationSettings_workspaceId_uidx" ON "integration_settings" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "linkedinIntegrations_workspaceId_uidx" ON "linkedin_integrations" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "linkedinPublications_workspaceId_idx" ON "linkedin_publications" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "linkedinPublications_postId_idx" ON "linkedin_publications" USING btree ("post_id");--> statement-breakpoint
CREATE UNIQUE INDEX "linkedinPublications_postId_uidx" ON "linkedin_publications" USING btree ("post_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mediumIntegrations_workspaceId_uidx" ON "medium_integrations" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "mediumPublications_workspaceId_idx" ON "medium_publications" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "mediumPublications_postId_idx" ON "medium_publications" USING btree ("post_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mediumPublications_postId_uidx" ON "medium_publications" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "onboardingFunnelEvents_userId_idx" ON "onboarding_funnel_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "onboardingFunnelEvents_createdAt_idx" ON "onboarding_funnel_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "onboardingFunnelEvents_step_idx" ON "onboarding_funnel_events" USING btree ("step");--> statement-breakpoint
CREATE UNIQUE INDEX "platformSettings_workspaceId_uidx" ON "platform_settings" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "portfolio_settings_workspaceId_uidx" ON "portfolio_settings" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "portfolio_settings_workspaceId_idx" ON "portfolio_settings" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "postPerformanceMetrics_postId_idx" ON "post_performance_metrics" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "postPerformanceMetrics_recordedAt_idx" ON "post_performance_metrics" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX "postReviewers_postId_idx" ON "post_reviewers" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "postReviewers_userId_idx" ON "post_reviewers" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "postReviewers_postId_userId_uidx" ON "post_reviewers" USING btree ("post_id","user_id");--> statement-breakpoint
CREATE INDEX "postRevisions_postId_idx" ON "post_revisions" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "postRevisions_postId_versionNumber_idx" ON "post_revisions" USING btree ("post_id","version_number");--> statement-breakpoint
CREATE INDEX "postStyleMetrics_postId_idx" ON "post_style_metrics" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "postStyleMetrics_workspaceId_idx" ON "post_style_metrics" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "posts_workspaceId_createdAt_idx" ON "posts" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "posts_createdBy_idx" ON "posts" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "recommendationFeedback_recommendationId_idx" ON "recommendation_feedback" USING btree ("recommendation_id");--> statement-breakpoint
CREATE INDEX "recommendationFeedback_userId_idx" ON "recommendation_feedback" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recommendationFeedback_action_idx" ON "recommendation_feedback" USING btree ("action");--> statement-breakpoint
CREATE INDEX "researchItems_postId_idx" ON "research_items" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "researchItems_workspaceId_idx" ON "research_items" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "riskFlagResolutions_postId_idx" ON "risk_flag_resolutions" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "riskFlagResolutions_postId_flagId_idx" ON "risk_flag_resolutions" USING btree ("post_id","flag_id");--> statement-breakpoint
CREATE INDEX "scanSources_workspaceId_idx" ON "scan_sources" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "scheduledPublications_workspaceId_idx" ON "scheduled_publications" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "scheduledPublications_postId_idx" ON "scheduled_publications" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "scheduledPublications_scheduledFor_idx" ON "scheduled_publications" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX "scheduledPublications_status_idx" ON "scheduled_publications" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "series_workspaceId_slug_uidx" ON "series" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE INDEX "series_workspaceId_idx" ON "series" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "seriesPosts_seriesId_postId_uidx" ON "series_posts" USING btree ("series_id","post_id");--> statement-breakpoint
CREATE UNIQUE INDEX "seriesPosts_postId_uidx" ON "series_posts" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "seriesPosts_seriesId_idx" ON "series_posts" USING btree ("series_id");--> statement-breakpoint
CREATE INDEX "seriesPosts_seriesId_order_idx" ON "series_posts" USING btree ("series_id","order");--> statement-breakpoint
CREATE INDEX "sessionBookmarks_workspaceId_idx" ON "session_bookmarks" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "sessionBookmarks_sessionId_idx" ON "session_bookmarks" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "socialAnalytics_workspaceId_idx" ON "social_analytics" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "socialAnalytics_postId_idx" ON "social_analytics" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "socialAnalytics_platform_idx" ON "social_analytics" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "socialAnalytics_syncedAt_idx" ON "social_analytics" USING btree ("synced_at");--> statement-breakpoint
CREATE UNIQUE INDEX "socialAnalytics_postId_platform_uidx" ON "social_analytics" USING btree ("post_id","platform");--> statement-breakpoint
CREATE UNIQUE INDEX "styleSettings_workspaceId_uidx" ON "style_settings" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "subscriptions_userId_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subscriptions_stripeCustomerId_idx" ON "subscriptions" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "twitterIntegrations_workspaceId_uidx" ON "twitter_integrations" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "twitterPublications_workspaceId_idx" ON "twitter_publications" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "twitterPublications_postId_idx" ON "twitter_publications" USING btree ("post_id");--> statement-breakpoint
CREATE UNIQUE INDEX "twitterPublications_postId_uidx" ON "twitter_publications" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "usageEvents_userId_idx" ON "usage_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "usageEvents_workspaceId_idx" ON "usage_events" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "usageEvents_createdAt_idx" ON "usage_events" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "usageMonthlySummary_userId_month_uidx" ON "usage_monthly_summary" USING btree ("user_id","month");--> statement-breakpoint
CREATE INDEX "usageMonthlySummary_userId_idx" ON "usage_monthly_summary" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "webhookEndpoints_workspaceId_idx" ON "webhook_endpoints" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "wordpressConnections_workspaceId_idx" ON "wordpress_connections" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspaceActivity_workspaceId_idx" ON "workspace_activity" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspaceActivity_workspaceId_createdAt_idx" ON "workspace_activity" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "workspaceActivity_userId_idx" ON "workspace_activity" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "workspaceInvites_workspaceId_idx" ON "workspace_invites" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspaceInvites_email_idx" ON "workspace_invites" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "workspaceMembers_workspaceId_userId_uidx" ON "workspace_members" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "workspaceMembers_workspaceId_idx" ON "workspace_members" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspaceMembers_userId_idx" ON "workspace_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_slug_uidx" ON "workspaces" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "writingSkills_workspaceId_idx" ON "writing_skills" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "writingSkills_workspace_filePath_uidx" ON "writing_skills" USING btree ("workspace_id","file_path");--> statement-breakpoint
CREATE INDEX "writingStyleProfiles_workspaceId_idx" ON "writing_style_profiles" USING btree ("workspace_id");