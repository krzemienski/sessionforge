import { pgEnum } from "drizzle-orm/pg-core";

export const lookbackWindowEnum = pgEnum("lookback_window", [
  "current_day",
  "yesterday",
  "last_7_days",
  "last_14_days",
  "last_30_days",
  "last_90_days",
  "all_time",
  "custom",
]);

export const pipelineSourceEnum = pgEnum("pipeline_source", [
  "manual",
  "trigger",
  "scheduled",
]);

export const postStatusEnum = pgEnum("post_status", [
  "draft",
  "published",
  "archived",
  "idea",
  "in_review",
  "scheduled",
  "approved",
]);

export const contentTypeEnum = pgEnum("content_type", [
  "blog_post",
  "twitter_thread",
  "linkedin_post",
  "devto_post",
  "changelog",
  "newsletter",
  "custom",
  "doc_page",
]);

export const insightCategoryEnum = pgEnum("insight_category", [
  "novel_problem_solving",
  "tool_pattern_discovery",
  "before_after_transformation",
  "failure_recovery",
  "architecture_decision",
  "performance_optimization",
]);

export const toneProfileEnum = pgEnum("tone_profile", [
  "technical",
  "tutorial",
  "conversational",
  "professional",
  "casual",
]);

export const triggerTypeEnum = pgEnum("trigger_type", [
  "manual",
  "scheduled",
  "file_watch",
]);

export const workspaceMemberRoleEnum = pgEnum("workspace_member_role", [
  "owner",
  "editor",
  "viewer",
  "reviewer",
  "publisher",
  "analyst",
]);

export const agentTypeEnum = pgEnum("agent_type", [
  "insight-extractor",
  "blog-writer",
  "social-writer",
  "changelog-writer",
  "editor-chat",
]);

export const agentRunStatusEnum = pgEnum("agent_run_status", [
  "running",
  "completed",
  "failed",
]);

export const styleProfileGenerationStatusEnum = pgEnum(
  "style_profile_generation_status",
  ["pending", "generating", "completed", "failed"]
);

export const automationRunStatusEnum = pgEnum("automation_run_status", [
  "pending",
  "scanning",
  "extracting",
  "generating",
  "complete",
  "failed",
]);

export const planTierEnum = pgEnum("plan_tier", [
  "free",
  "solo",
  "pro",
  "team",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "canceled",
  "past_due",
  "trialing",
  "incomplete",
  "incomplete_expired",
]);

export const usageEventTypeEnum = pgEnum("usage_event_type", [
  "session_scan",
  "insight_extraction",
  "content_generation",
]);

export const batchJobTypeEnum = pgEnum("batch_job_type", [
  "extract_insights",
  "generate_content",
  "batch_archive",
  "batch_delete",
  "backup_bundle",
  "restore_bundle",
]);

export const batchJobStatusEnum = pgEnum("batch_job_status", [
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
]);

export const templateTypeEnum = pgEnum("template_type", [
  "built_in",
  "custom",
  "workspace_default",
]);

export const socialPlatformEnum = pgEnum("social_platform", [
  "twitter",
  "linkedin",
]);

export const metricsPlatformEnum = pgEnum("metrics_platform", [
  "devto",
  "hashnode",
  "manual",
]);

export const editTypeEnum = pgEnum("edit_type", [
  "user_edit",
  "ai_generated",
  "auto_save",
  "restore",
]);

export const versionTypeEnum = pgEnum("version_type", [
  "major",
  "minor",
]);

export const scheduledPublicationStatusEnum = pgEnum("scheduled_publication_status", [
  "pending",
  "publishing",
  "published",
  "failed",
  "retry_exhausted",
  "paused",
]);

export const recommendationTypeEnum = pgEnum("recommendation_type", [
  "topic",
  "format",
  "length",
  "keyword",
  "improvement",
]);

export const portfolioThemeEnum = pgEnum("portfolio_theme", [
  "minimal",
  "developer-dark",
  "colorful",
]);

export const backupBundleStatusEnum = pgEnum("backup_bundle_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);

export const backupBundleFormatEnum = pgEnum("backup_bundle_format", [
  "json",
  "zip",
]);

export const verificationStatusEnum = pgEnum("verification_status", [
  "unverified",
  "pending",
  "verified",
  "has_issues",
]);

export const riskSeverityEnum = pgEnum("risk_severity", [
  "critical",
  "high",
  "medium",
  "low",
  "info",
]);

export const riskCategoryEnum = pgEnum("risk_category", [
  "unsupported_claim",
  "outdated_info",
  "version_specific",
  "subjective_opinion",
  "unverified_metric",
]);

export const riskFlagStatusEnum = pgEnum("risk_flag_status", [
  "unresolved",
  "verified",
  "dismissed",
  "overridden",
]);

export const experimentStatusEnum = pgEnum("experiment_status", [
  "draft",
  "running",
  "paused",
  "completed",
  "cancelled",
]);

export const experimentKpiEnum = pgEnum("experiment_kpi", [
  "views",
  "likes",
  "comments",
  "shares",
  "engagement_rate",
]);

export const approvalDecisionTypeEnum = pgEnum("approval_decision_type", [
  "approved",
  "rejected",
  "changes_requested",
]);

export const researchItemTypeEnum = pgEnum("research_item_type", [
  "link",
  "note",
  "code_snippet",
  "session_snippet",
]);

export const integrationHealthStatusEnum = pgEnum("integration_health_status", [
  "healthy",
  "degraded",
  "unhealthy",
  "paused",
]);

export const integrationPlatformEnum = pgEnum("integration_platform", [
  "devto",
  "ghost",
  "medium",
  "twitter",
  "linkedin",
  "wordpress",
]);

export const siteThemeEnum = pgEnum("site_theme", [
  "minimal-portfolio",
  "technical-blog",
  "changelog",
]);

export const feedbackActionEnum = pgEnum("feedback_action", [
  "accepted",
  "dismissed",
]);

export const contentAssetTypeEnum = pgEnum("content_asset_type", [
  "diagram",
  "hero_image",
  "section_image",
  "evidence_diagram",
  "timeline_viz",
]);

export const supplementaryTypeEnum = pgEnum("supplementary_type", [
  "twitter_thread",
  "linkedin_post",
  "newsletter_excerpt",
  "executive_summary",
  "pull_quotes",
  "slide_outline",
  "evidence_highlights",
]);
