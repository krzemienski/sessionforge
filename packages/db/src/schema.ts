import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  boolean,
  integer,
  real,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ── Enums (PRD §4.1) ──

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
]);

export const contentTypeEnum = pgEnum("content_type", [
  "blog_post",
  "twitter_thread",
  "linkedin_post",
  "devto_post",
  "changelog",
  "newsletter",
  "custom",
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

// ── Types ──

export interface SeoMetadata {
  metaTitle?: string | null;
  metaDescription?: string | null;
  focusKeyword?: string | null;
  additionalKeywords?: string[] | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  twitterTitle?: string | null;
  twitterDescription?: string | null;
  twitterCard?: string | null;
  schemaOrg?: Record<string, unknown> | null;
  readabilityScore?: number | null;
  readabilityGrade?: string | null;
  seoScore?: number | null;
  keywordDensity?: number | null;
  suggestedKeywords?: string[] | null;
  generatedAt?: string | null;
}

export interface RiskFlag {
  id: string;
  sentence: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  category:
    | "unsupported_claim"
    | "outdated_info"
    | "version_specific"
    | "subjective_opinion"
    | "unverified_metric";
  evidence: {
    sessionId?: string;
    messageIndex?: number;
    text: string;
    type: "session_snippet" | "insight" | "citation";
  }[];
  status: "unresolved" | "verified" | "dismissed" | "overridden";
  resolvedBy?: string | null;
  resolvedAt?: string | null;
}


// ── Tables (PRD §4.2) ──

export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false),
  onboardingCompleted: boolean("onboarding_completed").default(false),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
});

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    activeWorkspaceId: text("active_workspace_id"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
  },
  (table) => [index("auth_sessions_userId_idx").on(table.userId)]
);

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
  },
  (table) => [index("accounts_userId_idx").on(table.userId)]
);

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
});

export const workspaces = pgTable(
  "workspaces",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionBasePath: text("session_base_path").default("~/.claude"),
    lastScanAt: timestamp("last_scan_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
  },
  (table) => [uniqueIndex("workspaces_slug_uidx").on(table.slug)]
);

export const styleSettings = pgTable(
  "style_settings",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    defaultTone: toneProfileEnum("default_tone").default("technical"),
    targetAudience: text("target_audience").default("senior engineers"),
    customInstructions: text("custom_instructions"),
    includeCodeSnippets: boolean("include_code_snippets").default(true),
    includeTerminalOutput: boolean("include_terminal_output").default(true),
    maxBlogWordCount: integer("max_blog_word_count").default(2500),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("styleSettings_workspaceId_uidx").on(table.workspaceId),
  ]
);

export const integrationSettings = pgTable(
  "integration_settings",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    hashnodeApiToken: text("hashnode_api_token"),
    hashnodePublicationId: text("hashnode_publication_id"),
    hashnodeDefaultCanonicalDomain: text("hashnode_default_canonical_domain"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("integrationSettings_workspaceId_uidx").on(table.workspaceId),
  ]
);

export const claudeSessions = pgTable(
  "claude_sessions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    sessionId: text("session_id").notNull(),
    projectPath: text("project_path").notNull(),
    projectName: text("project_name").notNull(),
    filePath: text("file_path").notNull(),
    messageCount: integer("message_count").notNull(),
    toolsUsed: jsonb("tools_used").$type<string[]>(),
    filesModified: jsonb("files_modified").$type<string[]>(),
    errorsEncountered: jsonb("errors_encountered").$type<string[]>(),
    summary: text("summary"),
    startedAt: timestamp("started_at").notNull(),
    endedAt: timestamp("ended_at"),
    durationSeconds: integer("duration_seconds"),
    costUsd: real("cost_usd"),
    rawMetadata: jsonb("raw_metadata"),
    scannedAt: timestamp("scanned_at").defaultNow(),
  },
  (table) => [
    index("sessions_workspaceId_idx").on(table.workspaceId),
    index("sessions_startedAt_idx").on(table.startedAt),
    uniqueIndex("sessions_workspace_sessionId_uidx").on(
      table.workspaceId,
      table.sessionId
    ),
  ]
);

export const insights = pgTable(
  "insights",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    sessionId: text("session_id").references(() => claudeSessions.id),
    category: insightCategoryEnum("category").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    codeSnippets: jsonb("code_snippets").$type<
      { language: string; code: string; context: string }[]
    >(),
    terminalOutput: jsonb("terminal_output").$type<string[]>(),
    compositeScore: real("composite_score").notNull(),
    noveltyScore: real("novelty_score").default(0),
    toolPatternScore: real("tool_pattern_score").default(0),
    transformationScore: real("transformation_score").default(0),
    failureRecoveryScore: real("failure_recovery_score").default(0),
    reproducibilityScore: real("reproducibility_score").default(0),
    scaleScore: real("scale_score").default(0),
    usedInContent: boolean("used_in_content").default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("insights_workspaceId_idx").on(table.workspaceId),
    index("insights_compositeScore_idx").on(table.compositeScore),
  ]
);

export const writingStyleProfiles = pgTable(
  "writing_style_profiles",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull().default("Default Style"),
    description: text("description"),
    voiceCharacteristics: jsonb("voice_characteristics").$type<string[]>(),
    toneAttributes: jsonb("tone_attributes").$type<Record<string, number>>(),
    vocabularyLevel: text("vocabulary_level"),
    sentenceStructure: text("sentence_structure"),
    exampleExcerpts: jsonb("example_excerpts").$type<string[]>(),
    generationStatus: styleProfileGenerationStatusEnum("generation_status").default("pending"),
    generatedAt: timestamp("generated_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("writingStyleProfiles_workspaceId_idx").on(table.workspaceId),
  ]
);

export const posts = pgTable(
  "posts",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content").notNull(),
    markdown: text("markdown").notNull(),
    contentType: contentTypeEnum("content_type").notNull(),
    status: postStatusEnum("status").default("draft"),
    insightId: text("insight_id").references(() => insights.id),
    parentPostId: text("parent_post_id"),
    sourceMetadata: jsonb("source_metadata").$type<{
      triggerId?: string;
      sessionIds: string[];
      insightIds: string[];
      lookbackWindow?: string;
      generatedBy:
        | "blog_writer"
        | "social_writer"
        | "changelog_writer"
        | "editor_chat"
        | "manual"
        | "newsletter_writer";
    }>(),
    toneUsed: toneProfileEnum("tone_used"),
    wordCount: integer("word_count"),
    aiDraftMarkdown: text("ai_draft_markdown"),
    editDistance: integer("edit_distance"),
    styleProfileUsed: text("style_profile_used"),
    badgeEnabled: boolean("badge_enabled").default(false),
    platformFooterEnabled: boolean("platform_footer_enabled").default(false),
    hashnodeUrl: text("hashnode_url"),
    wordpressPublishedUrl: text("wordpress_published_url"),
    wordpressPostId: text("wordpress_post_id"),
    seoMetadata: jsonb("seo_metadata"),
    // ── SEO/GEO fields (from 014-seo-generative-engine-optimization-geo) ──
    metaTitle: text("meta_title"),
    metaDescription: text("meta_description"),
    ogImage: text("og_image"),
    keywords: jsonb("keywords").$type<string[]>(),
    structuredData: jsonb("structured_data"),
    readabilityScore: real("readability_score"),
    geoScore: real("geo_score"),
    geoChecklist: jsonb("geo_checklist").$type<
      { id: string; label: string; passed: boolean; suggestion?: string }[]
    >(),
    seoAnalysis: jsonb("seo_analysis"),
    citations: jsonb("citations").$type<
      {
        sessionId: string;
        messageIndex: number;
        text: string;
        type: "tool_call" | "file_edit" | "conversation" | "evidence";
      }[]
    >(),
    // ── Verification fields (from 024-factual-claim-verification-risk-flags) ──
    verificationStatus: verificationStatusEnum("verification_status").default("unverified"),
    riskFlags: jsonb("risk_flags").$type<RiskFlag[]>(),
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    publishedAt: timestamp("published_at"),
    scheduledFor: timestamp("scheduled_for"),
    timezone: text("timezone"),
    qstashScheduleId: text("qstash_schedule_id"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("posts_workspaceId_createdAt_idx").on(
      table.workspaceId,
      table.createdAt
    ),
    index("posts_createdBy_idx").on(table.createdBy),
  ]
);

// ── Risk Flag Resolutions (from 024-factual-claim-verification-risk-flags) ──

export const riskFlagResolutions = pgTable(
  "risk_flag_resolutions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    flagId: text("flag_id").notNull(),
    status: riskFlagStatusEnum("status").notNull(),
    resolvedBy: text("resolved_by").references(() => users.id, {
      onDelete: "set null",
    }),
    evidenceNotes: text("evidence_notes"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("riskFlagResolutions_postId_idx").on(table.postId),
    index("riskFlagResolutions_postId_flagId_idx").on(table.postId, table.flagId),
  ]
);

export const contentTriggers = pgTable(
  "content_triggers",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull().default("Untitled Schedule"),
    triggerType: triggerTypeEnum("trigger_type").notNull(),
    contentType: contentTypeEnum("content_type").notNull(),
    lookbackWindow: lookbackWindowEnum("lookback_window").default("last_7_days"),
    cronExpression: text("cron_expression"),
    qstashScheduleId: text("qstash_schedule_id"),
    enabled: boolean("enabled").default(true),
    lastRunAt: timestamp("last_run_at"),
    lastRunStatus: text("last_run_status"),
    debounceMinutes: integer("debounce_minutes").default(30),
    watchStatus: text("watch_status"),
    lastFileEventAt: timestamp("last_file_event_at"),
    fileWatchSnapshot: jsonb("file_watch_snapshot").$type<Record<string, number>>(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
  },
  (table) => [index("triggers_workspaceId_idx").on(table.workspaceId)]
);

export const scanSources = pgTable(
  "scan_sources",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    host: text("host").notNull(),
    port: integer("port").default(22),
    username: text("username").notNull(),
    encryptedPassword: text("encrypted_password").notNull(),
    basePath: text("base_path").default("~/.claude"),
    enabled: boolean("enabled").default(true),
    lastScannedAt: timestamp("last_scanned_at"),
    hostFingerprint: text("host_fingerprint"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
  },
  (table) => [index("scanSources_workspaceId_idx").on(table.workspaceId)]
);

export const apiKeys = pgTable(
  "api_keys",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    keyHash: text("key_hash").notNull(),
    keyPrefix: text("key_prefix").notNull(),
    lastUsedAt: timestamp("last_used_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("apiKeys_workspaceId_idx").on(table.workspaceId)]
);

export const sessionBookmarks = pgTable(
  "session_bookmarks",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    sessionId: text("session_id")
      .notNull()
      .references(() => claudeSessions.id, { onDelete: "cascade" }),
    messageIndex: integer("message_index").notNull(),
    label: text("label").notNull(),
    note: text("note"),
    sentToInsights: boolean("sent_to_insights").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("sessionBookmarks_workspaceId_idx").on(table.workspaceId),
    index("sessionBookmarks_sessionId_idx").on(table.sessionId),
  ]
);

export const contentMetrics = pgTable(
  "content_metrics",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    postId: text("post_id").references(() => posts.id, { onDelete: "set null" }),
    platform: metricsPlatformEnum("platform").notNull(),
    externalId: text("external_id"),
    title: text("title").notNull(),
    url: text("url"),
    views: integer("views").default(0),
    reactions: integer("reactions").default(0),
    comments: integer("comments").default(0),
    likes: integer("likes").default(0),
    publishedAt: timestamp("published_at"),
    fetchedAt: timestamp("fetched_at").defaultNow(),
  },
  (table) => [
    index("contentMetrics_workspaceId_idx").on(table.workspaceId),
    index("contentMetrics_fetchedAt_idx").on(table.fetchedAt),
    index("contentMetrics_platform_idx").on(table.platform),
  ]
);

export const platformSettings = pgTable(
  "platform_settings",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    devtoApiKey: text("devto_api_key"),
    devtoUsername: text("devto_username"),
    hashnodeApiKey: text("hashnode_api_key"),
    hashnodeUsername: text("hashnode_username"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("platformSettings_workspaceId_uidx").on(table.workspaceId),
  ]
);

export const postRevisions = pgTable(
  "post_revisions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    versionType: versionTypeEnum("version_type").notNull(),
    editType: editTypeEnum("edit_type").notNull(),
    contentSnapshot: text("content_snapshot"),
    contentDiff: jsonb("content_diff").$type<
      { count?: number; added?: boolean; removed?: boolean; value: string }[]
    >(),
    parentRevisionId: text("parent_revision_id"),
    title: text("title").notNull(),
    wordCount: integer("word_count").default(0),
    wordCountDelta: integer("word_count_delta").default(0),
    createdAt: timestamp("created_at").defaultNow(),
    createdBy: text("created_by"),
    versionLabel: text("version_label"),
    versionNotes: text("version_notes"),
  },
  (table) => [
    index("postRevisions_postId_idx").on(table.postId),
    index("postRevisions_postId_versionNumber_idx").on(
      table.postId,
      table.versionNumber
    ),
  ]
);

export const webhookEndpoints = pgTable(
  "webhook_endpoints",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    events: jsonb("events").$type<string[]>().notNull(),
    secret: text("secret").notNull(),
    enabled: boolean("enabled").default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
  },
  (table) => [index("webhookEndpoints_workspaceId_idx").on(table.workspaceId)]
);

export const webhookEndpointsRelations = relations(webhookEndpoints, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [webhookEndpoints.workspaceId],
    references: [workspaces.id],
  }),
}));

// ── Team Workspaces tables (from 023-team-workspaces-collaboration) ──

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: workspaceMemberRoleEnum("role").notNull().default("viewer"),
    invitedBy: text("invited_by").references(() => users.id, {
      onDelete: "set null",
    }),
    joinedAt: timestamp("joined_at").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("workspaceMembers_workspaceId_userId_uidx").on(
      table.workspaceId,
      table.userId
    ),
    index("workspaceMembers_workspaceId_idx").on(table.workspaceId),
    index("workspaceMembers_userId_idx").on(table.userId),
  ]
);

export const workspaceInvites = pgTable(
  "workspace_invites",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: workspaceMemberRoleEnum("role").notNull().default("viewer"),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    invitedBy: text("invited_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    acceptedAt: timestamp("accepted_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("workspaceInvites_workspaceId_idx").on(table.workspaceId),
    index("workspaceInvites_email_idx").on(table.email),
  ]
);

export const workspaceActivity = pgTable(
  "workspace_activity",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    resourceType: text("resource_type"),
    resourceId: text("resource_id"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("workspaceActivity_workspaceId_idx").on(table.workspaceId),
    index("workspaceActivity_workspaceId_createdAt_idx").on(
      table.workspaceId,
      table.createdAt
    ),
    index("workspaceActivity_userId_idx").on(table.userId),
  ]
);

// ── Collections & Series tables (from 013-static-site-github-pages-export) ──

export const siteThemeEnum = pgEnum("site_theme", [
  "minimal-portfolio",
  "technical-blog",
  "changelog",
]);

// ── Dev.to Integration tables (from 008-one-click-dev-to-publishing) ──

export const devtoIntegrations = pgTable(
  "devto_integrations",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    apiKey: text("api_key").notNull(),
    username: text("username"),
    enabled: boolean("enabled").default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("devtoIntegrations_workspaceId_uidx").on(table.workspaceId),
  ]
);

export const devtoPublications = pgTable(
  "devto_publications",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    integrationId: text("integration_id")
      .notNull()
      .references(() => devtoIntegrations.id, { onDelete: "cascade" }),
    devtoArticleId: integer("devto_article_id").notNull(),
    devtoUrl: text("devto_url"),
    publishedAsDraft: boolean("published_as_draft").default(false),
    syncedAt: timestamp("synced_at").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("devtoPublications_workspaceId_idx").on(table.workspaceId),
    index("devtoPublications_postId_idx").on(table.postId),
    uniqueIndex("devtoPublications_postId_uidx").on(table.postId),
  ]
);

// ── Scheduled Publications (from 002-content-scheduling-publish-queue) ──

export const scheduledPublications = pgTable(
  "scheduled_publications",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    platforms: jsonb("platforms").$type<string[]>().notNull(),
    scheduledFor: timestamp("scheduled_for").notNull(),
    status: scheduledPublicationStatusEnum("status").default("pending"),
    qstashScheduleId: text("qstash_schedule_id"),
    publishedAt: timestamp("published_at"),
    error: text("error"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("scheduledPublications_workspaceId_idx").on(table.workspaceId),
    index("scheduledPublications_postId_idx").on(table.postId),
    index("scheduledPublications_scheduledFor_idx").on(table.scheduledFor),
    index("scheduledPublications_status_idx").on(table.status),
  ]
);

// ── Ghost CMS Integration tables (from 016-ghost-cms-publishing-integration) ──

export const ghostIntegrations = pgTable(
  "ghost_integrations",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    ghostUrl: text("ghost_url").notNull(),
    adminApiKey: text("admin_api_key").notNull(),
    enabled: boolean("enabled").default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("ghostIntegrations_workspaceId_uidx").on(table.workspaceId),
  ]
);

export const ghostPublications = pgTable(
  "ghost_publications",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    integrationId: text("integration_id")
      .notNull()
      .references(() => ghostIntegrations.id, { onDelete: "cascade" }),
    ghostPostId: text("ghost_post_id").notNull(),
    ghostUrl: text("ghost_url"),
    publishedAsDraft: boolean("published_as_draft").default(false),
    syncedAt: timestamp("synced_at").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("ghostPublications_workspaceId_idx").on(table.workspaceId),
    index("ghostPublications_postId_idx").on(table.postId),
    uniqueIndex("ghostPublications_postId_uidx").on(table.postId),
  ]
);

// ── Medium Integration tables (from 003-medium-publishing-integration) ──

export const mediumIntegrations = pgTable(
  "medium_integrations",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    apiKey: text("api_key").notNull(),
    username: text("username"),
    mediumUserId: text("medium_user_id"),
    enabled: boolean("enabled").default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("mediumIntegrations_workspaceId_uidx").on(table.workspaceId),
  ]
);

export const mediumPublications = pgTable(
  "medium_publications",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    integrationId: text("integration_id")
      .notNull()
      .references(() => mediumIntegrations.id, { onDelete: "cascade" }),
    mediumArticleId: text("medium_article_id").notNull(),
    mediumUrl: text("medium_url"),
    publishedAsDraft: boolean("published_as_draft").default(false),
    syncedAt: timestamp("synced_at").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("mediumPublications_workspaceId_idx").on(table.workspaceId),
    index("mediumPublications_postId_idx").on(table.postId),
    uniqueIndex("mediumPublications_postId_uidx").on(table.postId),
  ]
);

// ── Agent Runs (from 004-error-recovery) ──

export const agentRuns = pgTable(
  "agent_runs",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    agentType: agentTypeEnum("agent_type").notNull(),
    status: agentRunStatusEnum("status").default("running"),
    attemptCount: integer("attempt_count").default(0),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at").defaultNow(),
    completedAt: timestamp("completed_at"),
    inputMetadata: jsonb("input_metadata"),
    resultMetadata: jsonb("result_metadata"),
  },
  (table) => [index("agentRuns_workspaceId_idx").on(table.workspaceId)]
);

// ── Agent Events (observability) ──

export const agentEvents = pgTable(
  "agent_events",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    traceId: text("trace_id").notNull(),
    parentEventId: text("parent_event_id"),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    agentType: text("agent_type").notNull(),
    agentRunId: text("agent_run_id"),
    eventType: text("event_type").notNull(),
    level: text("level").notNull().default("info"),
    payload: jsonb("payload").notNull().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("agentEvents_traceId_idx").on(table.traceId),
    index("agentEvents_workspace_time_idx").on(table.workspaceId, table.createdAt),
    index("agentEvents_eventType_idx").on(table.eventType),
  ]
);

// ── Writing Skills (from 021-skill-loader-ui-custom-writing-skills) ──

export const writingSkills = pgTable(
  "writing_skills",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    instructions: text("instructions").notNull(),
    appliesTo: jsonb("applies_to").$type<string[]>(),
    enabled: boolean("enabled").default(true),
    source: text("source").notNull(),
    filePath: text("file_path"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("writingSkills_workspaceId_idx").on(table.workspaceId),
    uniqueIndex("writingSkills_workspace_filePath_uidx").on(
      table.workspaceId,
      table.filePath
    ),
  ]
);

export const writingSkillsRelations = relations(writingSkills, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [writingSkills.workspaceId],
    references: [workspaces.id],
  }),
}));

// ── Automation Runs (from 013-working-automation-pipeline) ──

export const automationRuns = pgTable(
  "automation_runs",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    triggerId: text("trigger_id")
      .references(() => contentTriggers.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    source: pipelineSourceEnum("source").notNull().default("trigger"),
    status: automationRunStatusEnum("status").notNull().default("pending"),
    sessionsScanned: integer("sessions_scanned").notNull().default(0),
    insightsExtracted: integer("insights_extracted").notNull().default(0),
    postId: text("post_id").references(() => posts.id),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
    durationMs: integer("duration_ms"),
  },
  (table) => [
    index("automationRuns_workspaceId_idx").on(table.workspaceId),
    index("automationRuns_triggerId_idx").on(table.triggerId),
    index("automationRuns_startedAt_idx").on(table.startedAt),
  ]
);

export const automationRunsRelations = relations(automationRuns, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [automationRuns.workspaceId],
    references: [workspaces.id],
  }),
  trigger: one(contentTriggers, {
    fields: [automationRuns.triggerId],
    references: [contentTriggers.id],
  }),
  post: one(posts, {
    fields: [automationRuns.postId],
    references: [posts.id],
  }),
}));

// ── WordPress Connections table (from 034-wordpress-publishing-integration) ──

export const wordpressConnections = pgTable(
  "wordpress_connections",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    siteUrl: text("site_url").notNull(),
    username: text("username").notNull(),
    encryptedAppPassword: text("encrypted_app_password").notNull(),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
  },
  (table) => [index("wordpressConnections_workspaceId_idx").on(table.workspaceId)]
);

// ── Post Conversations (chat persistence) ──

export const postConversations = pgTable("post_conversations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  postId: text("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  messages: jsonb("messages").$type<{ role: string; content: string; toolActions?: string[] }[]>().default([]),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Billing tables (from 035-free-tier-usage-metering-dashboard) ──

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    planTier: planTierEnum("plan_tier").notNull().default("free"),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    currentPeriodStart: timestamp("current_period_start"),
    currentPeriodEnd: timestamp("current_period_end"),
    status: subscriptionStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("subscriptions_userId_idx").on(table.userId),
    index("subscriptions_stripeCustomerId_idx").on(table.stripeCustomerId),
  ]
);

export const usageEvents = pgTable(
  "usage_events",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    eventType: usageEventTypeEnum("event_type").notNull(),
    costUsd: real("cost_usd").default(0),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("usageEvents_userId_idx").on(table.userId),
    index("usageEvents_workspaceId_idx").on(table.workspaceId),
    index("usageEvents_createdAt_idx").on(table.createdAt),
  ]
);

export const usageMonthlySummary = pgTable(
  "usage_monthly_summary",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    sessionScans: integer("session_scans").notNull().default(0),
    insightExtractions: integer("insight_extractions").notNull().default(0),
    contentGenerations: integer("content_generations").notNull().default(0),
    estimatedCostUsd: real("estimated_cost_usd").notNull().default(0),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("usageMonthlySummary_userId_month_uidx").on(
      table.userId,
      table.month
    ),
    index("usageMonthlySummary_userId_idx").on(table.userId),
  ]
);

// ── Onboarding Funnel Events (from 018-interactive-onboarding-guided-setup-wizard) ──

export const onboardingFunnelEvents = pgTable(
  "onboarding_funnel_events",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    step: text("step").notNull(),
    event: text("event").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("onboardingFunnelEvents_userId_idx").on(table.userId),
    index("onboardingFunnelEvents_createdAt_idx").on(table.createdAt),
    index("onboardingFunnelEvents_step_idx").on(table.step),
  ]
);

// ── GitHub Integration tables (from 012-github-repository-deep-integration) ──

export const githubIntegrations = pgTable(
  "github_integrations",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    accessToken: text("access_token").notNull(),
    githubUsername: text("github_username"),
    enabled: boolean("enabled").default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("githubIntegrations_workspaceId_uidx").on(table.workspaceId),
  ]
);

export const githubRepositories = pgTable(
  "github_repositories",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    integrationId: text("integration_id")
      .notNull()
      .references(() => githubIntegrations.id, { onDelete: "cascade" }),
    githubRepoId: integer("github_repo_id").notNull(),
    repoName: text("repo_name").notNull(),
    repoUrl: text("repo_url").notNull(),
    defaultBranch: text("default_branch").default("main"),
    lastSyncedAt: timestamp("last_synced_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("githubRepositories_workspaceId_idx").on(table.workspaceId),
    index("githubRepositories_integrationId_idx").on(table.integrationId),
    uniqueIndex("githubRepositories_workspaceId_githubRepoId_uidx").on(
      table.workspaceId,
      table.githubRepoId
    ),
  ]
);

export const githubCommits = pgTable(
  "github_commits",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    repositoryId: text("repository_id")
      .notNull()
      .references(() => githubRepositories.id, { onDelete: "cascade" }),
    commitSha: text("commit_sha").notNull(),
    message: text("message").notNull(),
    authorName: text("author_name"),
    authorEmail: text("author_email"),
    authorDate: timestamp("author_date").notNull(),
    commitUrl: text("commit_url").notNull(),
    additions: integer("additions"),
    deletions: integer("deletions"),
    filesChanged: jsonb("files_changed").$type<string[]>(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("githubCommits_repositoryId_idx").on(table.repositoryId),
    index("githubCommits_authorDate_idx").on(table.authorDate),
    uniqueIndex("githubCommits_repositoryId_commitSha_uidx").on(
      table.repositoryId,
      table.commitSha
    ),
  ]
);

export const githubPullRequests = pgTable(
  "github_pull_requests",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    repositoryId: text("repository_id")
      .notNull()
      .references(() => githubRepositories.id, { onDelete: "cascade" }),
    prNumber: integer("pr_number").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    state: text("state").notNull(),
    authorName: text("author_name"),
    prUrl: text("pr_url").notNull(),
    mergedAt: timestamp("merged_at"),
    createdAtGithub: timestamp("created_at_github").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("githubPullRequests_repositoryId_idx").on(table.repositoryId),
    index("githubPullRequests_createdAtGithub_idx").on(table.createdAtGithub),
    uniqueIndex("githubPullRequests_repositoryId_prNumber_uidx").on(
      table.repositoryId,
      table.prNumber
    ),
  ]
);

export const githubIssues = pgTable(
  "github_issues",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    repositoryId: text("repository_id")
      .notNull()
      .references(() => githubRepositories.id, { onDelete: "cascade" }),
    issueNumber: integer("issue_number").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    state: text("state").notNull(),
    authorName: text("author_name"),
    issueUrl: text("issue_url").notNull(),
    createdAtGithub: timestamp("created_at_github").notNull(),
    closedAt: timestamp("closed_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("githubIssues_repositoryId_idx").on(table.repositoryId),
    index("githubIssues_createdAtGithub_idx").on(table.createdAtGithub),
    uniqueIndex("githubIssues_repositoryId_issueNumber_uidx").on(
      table.repositoryId,
      table.issueNumber
    ),
  ]
);

export const githubPrivacySettings = pgTable(
  "github_privacy_settings",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    repositoryId: text("repository_id").references(() => githubRepositories.id, {
      onDelete: "cascade",
    }),
    commitSha: text("commit_sha"),
    excludeFromContent: boolean("exclude_from_content").default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("githubPrivacySettings_workspaceId_idx").on(table.workspaceId),
    index("githubPrivacySettings_repositoryId_idx").on(table.repositoryId),
  ]
);


// -- Content Series & Collections --

export const series = pgTable(
  "series",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    slug: text("slug").notNull(),
    coverImage: text("cover_image"),
    isPublic: boolean("is_public").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("series_workspaceId_slug_uidx").on(table.workspaceId, table.slug),
    index("series_workspaceId_idx").on(table.workspaceId),
  ]
);

export const collections = pgTable(
  "collections",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    name: text("name"),
    description: text("description"),
    slug: text("slug").notNull(),
    coverImage: text("cover_image"),
    isPublic: boolean("is_public").default(false),
    theme: siteThemeEnum("theme").default("technical-blog"),
    customDomain: text("custom_domain"),
    poweredByFooter: boolean("powered_by_footer").default(true),
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("collections_workspaceId_slug_uidx").on(table.workspaceId, table.slug),
    index("collections_workspaceId_idx").on(table.workspaceId),
  ]
);

export const portfolioSettings = pgTable(
  "portfolio_settings",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    isEnabled: boolean("is_enabled").default(false),
    bio: text("bio"),
    avatarUrl: text("avatar_url"),
    socialLinks: jsonb("social_links"),
    pinnedPostIds: jsonb("pinned_post_ids"),
    theme: portfolioThemeEnum("theme").default("minimal"),
    customDomain: text("custom_domain"),
    showRss: boolean("show_rss").default(true),
    showPoweredBy: boolean("show_powered_by").default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("portfolio_settings_workspaceId_uidx").on(table.workspaceId),
    index("portfolio_settings_workspaceId_idx").on(table.workspaceId),
  ]
);

export const seriesPosts = pgTable(
  "series_posts",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    seriesId: text("series_id")
      .notNull()
      .references(() => series.id, { onDelete: "cascade" }),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    order: integer("order").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("seriesPosts_seriesId_postId_uidx").on(table.seriesId, table.postId),
    uniqueIndex("seriesPosts_postId_uidx").on(table.postId),
    index("seriesPosts_seriesId_idx").on(table.seriesId),
    index("seriesPosts_seriesId_order_idx").on(table.seriesId, table.order),
  ]
);

export const collectionPosts = pgTable(
  "collection_posts",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    collectionId: text("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    order: integer("order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("collectionPosts_collectionId_postId_uidx").on(
      table.collectionId,
      table.postId
    ),
    index("collectionPosts_collectionId_idx").on(table.collectionId),
    index("collectionPosts_collectionId_order_idx").on(table.collectionId, table.order),
  ]
);

// ── Content Templates (from 007-content-templates-library) ──

export const contentTemplates = pgTable(
  "content_templates",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id").references(() => workspaces.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    templateType: templateTypeEnum("template_type").notNull(),
    contentType: contentTypeEnum("content_type").notNull(),
    description: text("description"),
    structure: jsonb("structure").$type<{
      sections: {
        heading: string;
        description: string;
        required: boolean;
      }[];
    }>(),
    toneGuidance: text("tone_guidance"),
    exampleContent: text("example_content"),
    isActive: boolean("is_active").default(true),
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    usageCount: integer("usage_count").default(0),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("contentTemplates_workspaceId_idx").on(table.workspaceId),
    index("contentTemplates_templateType_idx").on(table.templateType),
    uniqueIndex("contentTemplates_slug_uidx").on(table.slug),
  ]
);

// ── Content Performance tables (from 011-content-performance-recommendations-engine) ──

export const postPerformanceMetrics = pgTable(
  "post_performance_metrics",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    views: integer("views").notNull().default(0),
    likes: integer("likes").notNull().default(0),
    comments: integer("comments").notNull().default(0),
    shares: integer("shares").notNull().default(0),
    engagementRate: real("engagement_rate").notNull().default(0),
    platform: text("platform").notNull(),
    recordedAt: timestamp("recorded_at").defaultNow(),
  },
  (table) => [
    index("postPerformanceMetrics_postId_idx").on(table.postId),
    index("postPerformanceMetrics_recordedAt_idx").on(table.recordedAt),
  ]
);

export const batchJobs = pgTable(
  "batch_jobs",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    type: batchJobTypeEnum("type").notNull(),
    status: batchJobStatusEnum("status").notNull().default("pending"),
    totalItems: integer("total_items").notNull().default(0),
    processedItems: integer("processed_items").notNull().default(0),
    successCount: integer("success_count").notNull().default(0),
    errorCount: integer("error_count").notNull().default(0),
    metadata: jsonb("metadata"),
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("batchJobs_workspaceId_idx").on(table.workspaceId),
    index("batchJobs_status_idx").on(table.status),
    index("batchJobs_createdBy_idx").on(table.createdBy),
  ]
);

export const engagementMetrics = pgTable(
  "engagement_metrics",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    publishedAt: timestamp("published_at"),
    views: integer("views").default(0),
    clicks: integer("clicks").default(0),
    shares: integer("shares").default(0),
    likes: integer("likes").default(0),
    comments: integer("comments").default(0),
    engagementRate: real("engagement_rate").default(0),
    platformSpecificMetrics: jsonb("platform_specific_metrics").$type<{
      platform?: string;
      metrics?: Record<string, number | string>;
    }>(),
    lastSyncedAt: timestamp("last_synced_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("engagementMetrics_workspaceId_idx").on(table.workspaceId),
    index("engagementMetrics_postId_idx").on(table.postId),
    index("engagementMetrics_publishedAt_idx").on(table.publishedAt),
    uniqueIndex("engagementMetrics_postId_uidx").on(table.postId),
  ]
);

export const contentRecommendations = pgTable(
  "content_recommendations",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    recommendationType: text("recommendation_type").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    reasoning: text("reasoning").notNull(),
    supportingData: jsonb("supporting_data"),
    confidenceScore: real("confidence_score"),
    helpfulRating: boolean("helpful_rating"),
    suggestedContentType: contentTypeEnum("suggested_content_type"),
    suggestedPublishTime: timestamp("suggested_publish_time"),
    insightId: text("insight_id").references(() => insights.id),
    priority: integer("priority").default(0),
    status: text("status").notNull().default("active"),
    metadata: jsonb("metadata").$type<{
      cadenceGap?: boolean;
      engagementPrediction?: number;
      relatedSessions?: string[];
      contentTypeMatch?: string;
      timezoneOptimized?: boolean;
    }>(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("contentRecommendations_workspaceId_idx").on(table.workspaceId),
    index("contentRecommendations_confidenceScore_idx").on(table.confidenceScore),
  ]
);

export const feedbackActionEnum = pgEnum("feedback_action", [
  "accepted",
  "dismissed",
]);

export const recommendationFeedback = pgTable(
  "recommendation_feedback",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    recommendationId: text("recommendation_id").notNull()
      .references(() => contentRecommendations.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: feedbackActionEnum("action").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("recommendationFeedback_recommendationId_idx").on(table.recommendationId),
    index("recommendationFeedback_userId_idx").on(table.userId),
    index("recommendationFeedback_action_idx").on(table.action),
  ]
);

// ── Relations (PRD §4.3) ──

export const usersRelations = relations(users, ({ many }) => ({
  workspaces: many(workspaces),
  authSessions: many(authSessions),
  accounts: many(accounts),
  workspaceMemberships: many(workspaceMembers, {
    relationName: "memberUser",
  }),
  sentInvites: many(workspaceInvites),
  activityEntries: many(workspaceActivity),
  posts: many(posts),
  subscriptions: many(subscriptions),
  usageEvents: many(usageEvents),
  usageMonthlySummary: many(usageMonthlySummary),
  contentTemplates: many(contentTemplates),
  recommendationFeedback: many(recommendationFeedback),
}));

export const authSessionsRelations = relations(authSessions, ({ one }) => ({
  user: one(users, {
    fields: [authSessions.userId],
    references: [users.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(users, {
    fields: [workspaces.ownerId],
    references: [users.id],
  }),
  styleSettings: one(styleSettings),
  portfolioSettings: one(portfolioSettings),
  claudeSessions: many(claudeSessions),
  insights: many(insights),
  posts: many(posts),
  contentTriggers: many(contentTriggers),
  apiKeys: many(apiKeys),
  members: many(workspaceMembers),
  invites: many(workspaceInvites),
  activity: many(workspaceActivity),
  devtoIntegrations: many(devtoIntegrations),
  devtoPublications: many(devtoPublications),
  ghostIntegrations: many(ghostIntegrations),
  ghostPublications: many(ghostPublications),
  mediumIntegrations: many(mediumIntegrations),
  mediumPublications: many(mediumPublications),
  agentRuns: many(agentRuns),
  writingSkills: many(writingSkills),
  sessionBookmarks: many(sessionBookmarks),
  automationRuns: many(automationRuns),
  usageEvents: many(usageEvents),
  postConversations: many(postConversations),
  collections: many(collections),
  series: many(series),
  contentTemplates: many(contentTemplates),
  githubIntegrations: many(githubIntegrations),
  githubRepositories: many(githubRepositories),
  githubPrivacySettings: many(githubPrivacySettings),
  contentRecommendations: many(contentRecommendations),
  twitterIntegrations: many(twitterIntegrations),
  linkedinIntegrations: many(linkedinIntegrations),
  twitterPublications: many(twitterPublications),
  linkedinPublications: many(linkedinPublications),
  socialAnalytics: many(socialAnalytics),
  scanSources: many(scanSources),
}));

export const styleSettingsRelations = relations(styleSettings, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [styleSettings.workspaceId],
    references: [workspaces.id],
  }),
}));

export const portfolioSettingsRelations = relations(portfolioSettings, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [portfolioSettings.workspaceId],
    references: [workspaces.id],
  }),
}));

export const claudeSessionsRelations = relations(
  claudeSessions,
  ({ one, many }) => ({
    workspace: one(workspaces, {
      fields: [claudeSessions.workspaceId],
      references: [workspaces.id],
    }),
    insights: many(insights),
  })
);

export const insightsRelations = relations(insights, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [insights.workspaceId],
    references: [workspaces.id],
  }),
  session: one(claudeSessions, {
    fields: [insights.sessionId],
    references: [claudeSessions.id],
  }),
  posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [posts.workspaceId],
    references: [workspaces.id],
  }),
  insight: one(insights, {
    fields: [posts.insightId],
    references: [insights.id],
  }),
  author: one(users, {
    fields: [posts.createdBy],
    references: [users.id],
  }),
  devtoPublication: one(devtoPublications, {
    fields: [posts.id],
    references: [devtoPublications.postId],
  }),
  mediumPublication: one(mediumPublications, {
    fields: [posts.id],
    references: [mediumPublications.postId],
  }),
  writingStyleProfile: one(writingStyleProfiles, {
    fields: [posts.styleProfileUsed],
    references: [writingStyleProfiles.id],
  }),
  automationRuns: many(automationRuns),
  revisions: many(postRevisions),
  conversations: many(postConversations),
  collectionPosts: many(collectionPosts),
  seriesPosts: many(seriesPosts),
  performanceMetrics: many(postPerformanceMetrics),
  engagementMetrics: one(engagementMetrics, {
    fields: [posts.id],
    references: [engagementMetrics.postId],
  }),
  twitterPublication: one(twitterPublications, {
    fields: [posts.id],
    references: [twitterPublications.postId],
  }),
  linkedinPublication: one(linkedinPublications, {
    fields: [posts.id],
    references: [linkedinPublications.postId],
  }),
  socialAnalytics: many(socialAnalytics),
  styleMetrics: one(postStyleMetrics, {
    fields: [posts.id],
    references: [postStyleMetrics.postId],
  }),
  riskFlagResolutions: many(riskFlagResolutions),
}));

export const riskFlagResolutionsRelations = relations(
  riskFlagResolutions,
  ({ one }) => ({
    post: one(posts, {
      fields: [riskFlagResolutions.postId],
      references: [posts.id],
    }),
    resolver: one(users, {
      fields: [riskFlagResolutions.resolvedBy],
      references: [users.id],
    }),
  })
);

export const postRevisionsRelations = relations(postRevisions, ({ one }) => ({
  post: one(posts, {
    fields: [postRevisions.postId],
    references: [posts.id],
  }),
}));

export const contentTriggersRelations = relations(
  contentTriggers,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [contentTriggers.workspaceId],
      references: [workspaces.id],
    }),
  })
);

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [apiKeys.workspaceId],
    references: [workspaces.id],
  }),
}));

export const workspaceMembersRelations = relations(
  workspaceMembers,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [workspaceMembers.workspaceId],
      references: [workspaces.id],
    }),
    user: one(users, {
      fields: [workspaceMembers.userId],
      references: [users.id],
      relationName: "memberUser",
    }),
    inviter: one(users, {
      fields: [workspaceMembers.invitedBy],
      references: [users.id],
      relationName: "memberInviter",
    }),
  })
);

export const workspaceInvitesRelations = relations(
  workspaceInvites,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [workspaceInvites.workspaceId],
      references: [workspaces.id],
    }),
    inviter: one(users, {
      fields: [workspaceInvites.invitedBy],
      references: [users.id],
    }),
  })
);

export const workspaceActivityRelations = relations(
  workspaceActivity,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [workspaceActivity.workspaceId],
      references: [workspaces.id],
    }),
    user: one(users, {
      fields: [workspaceActivity.userId],
      references: [users.id],
    }),
  })
);

export const devtoIntegrationsRelations = relations(
  devtoIntegrations,
  ({ one, many }) => ({
    workspace: one(workspaces, {
      fields: [devtoIntegrations.workspaceId],
      references: [workspaces.id],
    }),
    publications: many(devtoPublications),
  })
);

export const devtoPublicationsRelations = relations(
  devtoPublications,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [devtoPublications.workspaceId],
      references: [workspaces.id],
    }),
    post: one(posts, {
      fields: [devtoPublications.postId],
      references: [posts.id],
    }),
    integration: one(devtoIntegrations, {
      fields: [devtoPublications.integrationId],
      references: [devtoIntegrations.id],
    }),
  })
);

export const githubIntegrationsRelations = relations(
  githubIntegrations,
  ({ one, many }) => ({
    workspace: one(workspaces, {
      fields: [githubIntegrations.workspaceId],
      references: [workspaces.id],
    }),
    repositories: many(githubRepositories),
  })
);

export const githubRepositoriesRelations = relations(
  githubRepositories,
  ({ one, many }) => ({
    workspace: one(workspaces, {
      fields: [githubRepositories.workspaceId],
      references: [workspaces.id],
    }),
    integration: one(githubIntegrations, {
      fields: [githubRepositories.integrationId],
      references: [githubIntegrations.id],
    }),
    commits: many(githubCommits),
    pullRequests: many(githubPullRequests),
    issues: many(githubIssues),
    privacySettings: many(githubPrivacySettings),
  })
);

export const githubCommitsRelations = relations(githubCommits, ({ one }) => ({
  repository: one(githubRepositories, {
    fields: [githubCommits.repositoryId],
    references: [githubRepositories.id],
  }),
}));

export const githubPullRequestsRelations = relations(
  githubPullRequests,
  ({ one }) => ({
    repository: one(githubRepositories, {
      fields: [githubPullRequests.repositoryId],
      references: [githubRepositories.id],
    }),
  })
);

export const githubIssuesRelations = relations(githubIssues, ({ one }) => ({
  repository: one(githubRepositories, {
    fields: [githubIssues.repositoryId],
    references: [githubRepositories.id],
  }),
}));

export const githubPrivacySettingsRelations = relations(
  githubPrivacySettings,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [githubPrivacySettings.workspaceId],
      references: [workspaces.id],
    }),
    repository: one(githubRepositories, {
      fields: [githubPrivacySettings.repositoryId],
      references: [githubRepositories.id],
    }),
  })
);

export const collectionsRelations = relations(collections, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [collections.workspaceId],
    references: [workspaces.id],
  }),
  createdBy: one(users, {
    fields: [collections.createdBy],
    references: [users.id],
  }),
  collectionPosts: many(collectionPosts),
  series: many(series),
}));

export const collectionPostsRelations = relations(
  collectionPosts,
  ({ one }) => ({
    collection: one(collections, {
      fields: [collectionPosts.collectionId],
      references: [collections.id],
    }),
    post: one(posts, {
      fields: [collectionPosts.postId],
      references: [posts.id],
    }),
  })
);

export const postPerformanceMetricsRelations = relations(
  postPerformanceMetrics,
  ({ one }) => ({
    post: one(posts, {
      fields: [postPerformanceMetrics.postId],
      references: [posts.id],
    }),
  })
);

export const postConversationsRelations = relations(postConversations, ({ one }) => ({
  post: one(posts, {
    fields: [postConversations.postId],
    references: [posts.id],
  }),
  workspace: one(workspaces, {
    fields: [postConversations.workspaceId],
    references: [workspaces.id],
  }),
}));

// ── Content Assets (Phase 5 – Diagrams & Media) ──

export const contentAssetTypeEnum = pgEnum("content_asset_type", [
  "diagram",
  "hero_image",
  "section_image",
  "evidence_diagram",
  "timeline_viz",
]);

export const contentAssets = pgTable("content_assets", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  postId: text("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  assetType: contentAssetTypeEnum("asset_type").notNull(),
  content: text("content").notNull(),
  altText: text("alt_text"),
  caption: text("caption"),
  placement: jsonb("placement").$type<{ section?: string; position?: string }>().default({}),
  metadata: jsonb("metadata").$type<{ generatedAt?: string; model?: string; diagramType?: string }>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const contentRecommendationsRelations = relations(
  contentRecommendations,
  ({ one, many }) => ({
    workspace: one(workspaces, {
      fields: [contentRecommendations.workspaceId],
      references: [workspaces.id],
    }),
    insight: one(insights, {
      fields: [contentRecommendations.insightId],
      references: [insights.id],
    }),
    feedback: many(recommendationFeedback),
  })
);

export const engagementMetricsRelations = relations(
  engagementMetrics,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [engagementMetrics.workspaceId],
      references: [workspaces.id],
    }),
    post: one(posts, {
      fields: [engagementMetrics.postId],
      references: [posts.id],
    }),
  })
);

export const batchJobsRelations = relations(batchJobs, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [batchJobs.workspaceId],
    references: [workspaces.id],
  }),
  createdByUser: one(users, {
    fields: [batchJobs.createdBy],
    references: [users.id],
  }),
}));

export const recommendationFeedbackRelations = relations(
  recommendationFeedback,
  ({ one }) => ({
    recommendation: one(contentRecommendations, {
      fields: [recommendationFeedback.recommendationId],
      references: [contentRecommendations.id],
    }),
    user: one(users, {
      fields: [recommendationFeedback.userId],
      references: [users.id],
    }),
  })
);

// ── Social Media Integration tables (from 010-social-media-engagement-analytics) ──

export const twitterIntegrations = pgTable(
  "twitter_integrations",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    twitterUserId: text("twitter_user_id"),
    username: text("username"),
    enabled: boolean("enabled").default(true),
    lastSyncAt: timestamp("last_sync_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("twitterIntegrations_workspaceId_uidx").on(table.workspaceId),
  ]
);

export const linkedinIntegrations = pgTable(
  "linkedin_integrations",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    linkedinUserId: text("linkedin_user_id"),
    username: text("username"),
    enabled: boolean("enabled").default(true),
    lastSyncAt: timestamp("last_sync_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("linkedinIntegrations_workspaceId_uidx").on(table.workspaceId),
  ]
);

export const twitterPublications = pgTable(
  "twitter_publications",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    integrationId: text("integration_id")
      .notNull()
      .references(() => twitterIntegrations.id, { onDelete: "cascade" }),
    tweetId: text("tweet_id").notNull(),
    tweetUrl: text("tweet_url"),
    publishedAsThread: boolean("published_as_thread").default(false),
    syncedAt: timestamp("synced_at").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("twitterPublications_workspaceId_idx").on(table.workspaceId),
    index("twitterPublications_postId_idx").on(table.postId),
    uniqueIndex("twitterPublications_postId_uidx").on(table.postId),
  ]
);

export const linkedinPublications = pgTable(
  "linkedin_publications",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    integrationId: text("integration_id")
      .notNull()
      .references(() => linkedinIntegrations.id, { onDelete: "cascade" }),
    linkedinPostId: text("linkedin_post_id").notNull(),
    linkedinUrl: text("linkedin_url"),
    syncedAt: timestamp("synced_at").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("linkedinPublications_workspaceId_idx").on(table.workspaceId),
    index("linkedinPublications_postId_idx").on(table.postId),
    uniqueIndex("linkedinPublications_postId_uidx").on(table.postId),
  ]
);

export const socialAnalytics = pgTable(
  "social_analytics",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    platform: socialPlatformEnum("platform").notNull(),
    impressions: integer("impressions").default(0),
    likes: integer("likes").default(0),
    shares: integer("shares").default(0),
    comments: integer("comments").default(0),
    clicks: integer("clicks").default(0),
    rawMetrics: jsonb("raw_metrics"),
    syncedAt: timestamp("synced_at").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("socialAnalytics_workspaceId_idx").on(table.workspaceId),
    index("socialAnalytics_postId_idx").on(table.postId),
    index("socialAnalytics_platform_idx").on(table.platform),
    index("socialAnalytics_syncedAt_idx").on(table.syncedAt),
    uniqueIndex("socialAnalytics_postId_platform_uidx").on(
      table.postId,
      table.platform
    ),
  ]
);

// ── Supplementary Content (Phase 6) ──

export const supplementaryTypeEnum = pgEnum("supplementary_type", [
  "twitter_thread",
  "linkedin_post",
  "newsletter_excerpt",
  "executive_summary",
  "pull_quotes",
  "slide_outline",
  "evidence_highlights",
]);

export const supplementaryContent = pgTable("supplementary_content", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  postId: text("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  contentType: supplementaryTypeEnum("content_type").notNull(),
  content: text("content").notNull(),
  metadata: jsonb("metadata")
    .$type<{ charCount?: number; platform?: string; format?: string }>()
    .default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const supplementaryContentRelations = relations(supplementaryContent, ({ one }) => ({
  post: one(posts, {
    fields: [supplementaryContent.postId],
    references: [posts.id],
  }),
  workspace: one(workspaces, {
    fields: [supplementaryContent.workspaceId],
    references: [workspaces.id],
  }),
}));

export const contentAssetsRelations = relations(contentAssets, ({ one }) => ({
  post: one(posts, {
    fields: [contentAssets.postId],
    references: [posts.id],
  }),
  workspace: one(workspaces, {
    fields: [contentAssets.workspaceId],
    references: [workspaces.id],
  }),
}));

export const seriesRelations = relations(series, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [series.workspaceId],
    references: [workspaces.id],
  }),
  seriesPosts: many(seriesPosts),
}));

export const seriesPostsRelations = relations(seriesPosts, ({ one }) => ({
  series: one(series, {
    fields: [seriesPosts.seriesId],
    references: [series.id],
  }),
  post: one(posts, {
    fields: [seriesPosts.postId],
    references: [posts.id],
  }),
}));

export const scheduledPublicationsRelations = relations(
  scheduledPublications,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [scheduledPublications.workspaceId],
      references: [workspaces.id],
    }),
    post: one(posts, {
      fields: [scheduledPublications.postId],
      references: [posts.id],
    }),
  })
);

export const ghostIntegrationsRelations = relations(
  ghostIntegrations,
  ({ one, many }) => ({
    workspace: one(workspaces, {
      fields: [ghostIntegrations.workspaceId],
      references: [workspaces.id],
    }),
    publications: many(ghostPublications),
  })
);

export const ghostPublicationsRelations = relations(
  ghostPublications,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [ghostPublications.workspaceId],
      references: [workspaces.id],
    }),
    post: one(posts, {
      fields: [ghostPublications.postId],
      references: [posts.id],
    }),
    integration: one(ghostIntegrations, {
      fields: [ghostPublications.integrationId],
      references: [ghostIntegrations.id],
    }),
  })
);

export const contentTemplatesRelations = relations(
  contentTemplates,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [contentTemplates.workspaceId],
      references: [workspaces.id],
    }),
    creator: one(users, {
      fields: [contentTemplates.createdBy],
      references: [users.id],
    }),
  })
);

export const mediumIntegrationsRelations = relations(
  mediumIntegrations,
  ({ one, many }) => ({
    workspace: one(workspaces, {
      fields: [mediumIntegrations.workspaceId],
      references: [workspaces.id],
    }),
    publications: many(mediumPublications),
  })
);

export const mediumPublicationsRelations = relations(
  mediumPublications,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [mediumPublications.workspaceId],
      references: [workspaces.id],
    }),
    post: one(posts, {
      fields: [mediumPublications.postId],
      references: [posts.id],
    }),
    integration: one(mediumIntegrations, {
      fields: [mediumPublications.integrationId],
      references: [mediumIntegrations.id],
    }),
  })
);

export const twitterIntegrationsRelations = relations(
  twitterIntegrations,
  ({ one, many }) => ({
    workspace: one(workspaces, {
      fields: [twitterIntegrations.workspaceId],
      references: [workspaces.id],
    }),
    publications: many(twitterPublications),
  })
);

export const linkedinIntegrationsRelations = relations(
  linkedinIntegrations,
  ({ one, many }) => ({
    workspace: one(workspaces, {
      fields: [linkedinIntegrations.workspaceId],
      references: [workspaces.id],
    }),
    publications: many(linkedinPublications),
  })
);

export const twitterPublicationsRelations = relations(
  twitterPublications,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [twitterPublications.workspaceId],
      references: [workspaces.id],
    }),
    post: one(posts, {
      fields: [twitterPublications.postId],
      references: [posts.id],
    }),
    integration: one(twitterIntegrations, {
      fields: [twitterPublications.integrationId],
      references: [twitterIntegrations.id],
    }),
  })
);

export const linkedinPublicationsRelations = relations(
  linkedinPublications,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [linkedinPublications.workspaceId],
      references: [workspaces.id],
    }),
    post: one(posts, {
      fields: [linkedinPublications.postId],
      references: [posts.id],
    }),
    integration: one(linkedinIntegrations, {
      fields: [linkedinPublications.integrationId],
      references: [linkedinIntegrations.id],
    }),
  })
);

export const socialAnalyticsRelations = relations(
  socialAnalytics,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [socialAnalytics.workspaceId],
      references: [workspaces.id],
    }),
    post: one(posts, {
      fields: [socialAnalytics.postId],
      references: [posts.id],
    }),
  })
);

export const scanSourcesRelations = relations(scanSources, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [scanSources.workspaceId],
    references: [workspaces.id],
  }),
}));

// ── Writing Coach: Post Style Metrics ──

export interface AiPatternMatch {
  phrase: string;
  category: string;
  suggestion: string;
}

export const postStyleMetrics = pgTable(
  "post_style_metrics",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    readabilityScore: real("readability_score"),
    gradeLevel: real("grade_level"),
    wordCount: integer("word_count"),
    sentenceCount: integer("sentence_count"),
    avgSentenceLength: real("avg_sentence_length"),
    avgSyllablesPerWord: real("avg_syllables_per_word"),
    vocabDiversity: real("vocab_diversity"),
    passiveVoicePct: real("passive_voice_pct"),
    codeToProseRatio: real("code_to_prose_ratio"),
    aiPatternCount: integer("ai_pattern_count"),
    aiPatternMatches: jsonb("ai_pattern_matches").$type<AiPatternMatch[]>(),
    authenticityScore: real("authenticity_score"),
    voiceConsistencyScore: real("voice_consistency_score"),
    suggestions: jsonb("suggestions"),
    analyzedAt: timestamp("analyzed_at").defaultNow(),
  },
  (table) => [
    index("postStyleMetrics_postId_idx").on(table.postId),
    index("postStyleMetrics_workspaceId_idx").on(table.workspaceId),
  ]
);

export const postStyleMetricsRelations = relations(postStyleMetrics, ({ one }) => ({
  post: one(posts, {
    fields: [postStyleMetrics.postId],
    references: [posts.id],
  }),
  workspace: one(workspaces, {
    fields: [postStyleMetrics.workspaceId],
    references: [workspaces.id],
  }),
}));
