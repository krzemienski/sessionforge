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
import { relations } from "drizzle-orm/relations";

// ── Enums (PRD §4.1) ──

export const lookbackWindowEnum = pgEnum("lookback_window", [
  "current_day",
  "yesterday",
  "last_7_days",
  "last_14_days",
  "last_30_days",
  "custom",
]);

export const postStatusEnum = pgEnum("post_status", [
  "draft",
  "published",
  "archived",
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

export const templateTypeEnum = pgEnum("template_type", [
  "built_in",
  "custom",
  "workspace_default",
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


// ── Tables (PRD §4.2) ──

export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false),
  onboardingCompleted: boolean("onboarding_completed").default(false).notNull(),
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
    formality: real("formality"),
    technicalDepth: real("technical_depth"),
    humor: real("humor"),
    headingStyle: jsonb("heading_style").$type<{
      preferredLevels: string[];
      capitalization: "title" | "sentence" | "all_caps";
      includeEmoji: boolean;
    }>(),
    codeStyle: jsonb("code_style").$type<{
      commentDensity: "minimal" | "moderate" | "heavy";
      preferInlineComments: boolean;
      explanationStyle: "before" | "after" | "inline";
    }>(),
    vocabularyPatterns: jsonb("vocabulary_patterns").$type<string[]>(),
    sampleEdits: jsonb("sample_edits").$type<
      { original: string; edited: string; postId: string }[]
    >(),
    publishedPostsAnalyzed: integer("published_posts_analyzed").default(0),
    generationStatus: styleProfileGenerationStatusEnum(
      "generation_status"
    ).default("pending"),
    lastGeneratedAt: timestamp("last_generated_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("writingStyleProfiles_workspaceId_uidx").on(table.workspaceId),
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
    parentPostId: text("parent_post_id").references((): any => posts.id),
    sourceMetadata: jsonb("source_metadata").$type<{
      triggerId?: string;
      sessionIds?: string[];
      insightIds?: string[];
      lookbackWindow?: string;
      parentPostId?: string;
      generatedBy:
        | "blog_writer"
        | "social_writer"
        | "changelog_writer"
        | "editor_chat"
        | "manual"
        | "repurpose_writer"
        | "newsletter_writer";
    }>(),
    toneUsed: toneProfileEnum("tone_used"),
    wordCount: integer("word_count"),
    hashnodeUrl: text("hashnode_url"),
    aiDraftMarkdown: text("ai_draft_markdown"),
    editDistance: integer("edit_distance"),
    styleProfileUsed: text("style_profile_used").references(
      () => writingStyleProfiles.id,
      { onDelete: "set null" }
    ),
    seoMetadata: jsonb("seo_metadata").$type<SeoMetadata>(),
    badgeEnabled: boolean("badge_enabled").default(false),
    platformFooterEnabled: boolean("platform_footer_enabled").default(false),
    wordpressPublishedUrl: text("wordpress_published_url"),
    wordpressPostId: integer("wordpress_post_id"),
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    publishedAt: timestamp("published_at"),
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

// ── Analytics tables (from 018-content-performance-analytics-dashboard) ──

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

// ── Revision History tables (from 027-content-revision-history-version-tracking) ──

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
  },
  (table) => [
    index("postRevisions_postId_idx").on(table.postId),
    index("postRevisions_postId_versionNumber_idx").on(
      table.postId,
      table.versionNumber
    ),
  ]
);

// ── Webhook Endpoints table (from 031-public-rest-api-webhook-events) ──

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

// ── Automation Runs (from 013-working-automation-pipeline) ──

export const automationRuns = pgTable(
  "automation_runs",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    triggerId: text("trigger_id")
      .notNull()
      .references(() => contentTriggers.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
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
  content: text("content").notNull(), // Mermaid markup or image URL
  altText: text("alt_text"),
  caption: text("caption"),
  placement: jsonb("placement").$type<{ section?: string; position?: string }>().default({}),
  metadata: jsonb("metadata").$type<{ generatedAt?: string; model?: string; diagramType?: string }>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
  integrationSettings: one(integrationSettings),
  writingStyleProfiles: many(writingStyleProfiles),
  claudeSessions: many(claudeSessions),
  insights: many(insights),
  posts: many(posts),
  contentTriggers: many(contentTriggers),
  apiKeys: many(apiKeys),
  contentMetrics: many(contentMetrics),
  platformSettings: one(platformSettings),
  webhookEndpoints: many(webhookEndpoints),
  wordpressConnections: many(wordpressConnections),
  members: many(workspaceMembers),
  invites: many(workspaceInvites),
  activity: many(workspaceActivity),
  devtoIntegrations: many(devtoIntegrations),
  devtoPublications: many(devtoPublications),
  ghostIntegrations: many(ghostIntegrations),
  ghostPublications: many(ghostPublications),
  agentRuns: many(agentRuns),
  writingSkills: many(writingSkills),
  sessionBookmarks: many(sessionBookmarks),
  automationRuns: many(automationRuns),
  usageEvents: many(usageEvents),
  postConversations: many(postConversations),
}));

export const styleSettingsRelations = relations(styleSettings, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [styleSettings.workspaceId],
    references: [workspaces.id],
  }),
}));

export const integrationSettingsRelations = relations(
  integrationSettings,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [integrationSettings.workspaceId],
      references: [workspaces.id],
    }),
  })
);

export const writingStyleProfilesRelations = relations(
  writingStyleProfiles,
  ({ one, many }) => ({
    workspace: one(workspaces, {
      fields: [writingStyleProfiles.workspaceId],
      references: [workspaces.id],
    }),
    posts: many(posts),
  })
);

export const claudeSessionsRelations = relations(
  claudeSessions,
  ({ one, many }) => ({
    workspace: one(workspaces, {
      fields: [claudeSessions.workspaceId],
      references: [workspaces.id],
    }),
    insights: many(insights),
    sessionBookmarks: many(sessionBookmarks),
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
  parentPost: one(posts, {
    fields: [posts.parentPostId],
    references: [posts.id],
    relationName: "post_repurposed_from",
  }),
  repurposedPosts: many(posts, {
    relationName: "post_repurposed_from",
  }),
  contentMetrics: many(contentMetrics),
  author: one(users, {
    fields: [posts.createdBy],
    references: [users.id],
  }),
  devtoPublication: one(devtoPublications, {
    fields: [posts.id],
    references: [devtoPublications.postId],
  }),
  writingStyleProfile: one(writingStyleProfiles, {
    fields: [posts.styleProfileUsed],
    references: [writingStyleProfiles.id],
  }),
  automationRuns: many(automationRuns),
  revisions: many(postRevisions),
  conversations: many(postConversations),
}));

export const postRevisionsRelations = relations(postRevisions, ({ one }) => ({
  post: one(posts, {
    fields: [postRevisions.postId],
    references: [posts.id],
  }),
}));

export const contentTriggersRelations = relations(
  contentTriggers,
  ({ one, many }) => ({
    workspace: one(workspaces, {
      fields: [contentTriggers.workspaceId],
      references: [workspaces.id],
    }),
    automationRuns: many(automationRuns),
  })
);

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [apiKeys.workspaceId],
    references: [workspaces.id],
  }),
}));

export const contentMetricsRelations = relations(contentMetrics, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [contentMetrics.workspaceId],
    references: [workspaces.id],
  }),
  post: one(posts, {
    fields: [contentMetrics.postId],
    references: [posts.id],
  }),
}));

export const platformSettingsRelations = relations(
  platformSettings,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [platformSettings.workspaceId],
      references: [workspaces.id],
    }),
  })
);

export const webhookEndpointsRelations = relations(
  webhookEndpoints,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [webhookEndpoints.workspaceId],
      references: [workspaces.id],
    }),
  })
);

export const wordpressConnectionsRelations = relations(
  wordpressConnections,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [wordpressConnections.workspaceId],
      references: [workspaces.id],
    }),
  })
);

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

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
}));

export const usageEventsRelations = relations(usageEvents, ({ one }) => ({
  user: one(users, {
    fields: [usageEvents.userId],
    references: [users.id],
  }),
  workspace: one(workspaces, {
    fields: [usageEvents.workspaceId],
    references: [workspaces.id],
  }),
}));

export const usageMonthlySummaryRelations = relations(
  usageMonthlySummary,
  ({ one }) => ({
    user: one(users, {
      fields: [usageMonthlySummary.userId],
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

export const agentRunsRelations = relations(agentRuns, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [agentRuns.workspaceId],
    references: [workspaces.id],
  }),
}));

export const writingSkillsRelations = relations(writingSkills, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [writingSkills.workspaceId],
    references: [workspaces.id],
  }),
}));

export const sessionBookmarksRelations = relations(
  sessionBookmarks,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [sessionBookmarks.workspaceId],
      references: [workspaces.id],
    }),
    session: one(claudeSessions, {
      fields: [sessionBookmarks.sessionId],
      references: [claudeSessions.id],
    }),
  })
);

export const automationRunsRelations = relations(
  automationRuns,
  ({ one }) => ({
    trigger: one(contentTriggers, {
      fields: [automationRuns.triggerId],
      references: [contentTriggers.id],
    }),
    workspace: one(workspaces, {
      fields: [automationRuns.workspaceId],
      references: [workspaces.id],
    }),
    post: one(posts, {
      fields: [automationRuns.postId],
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
