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
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
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

export const collections = pgTable(
  "collections",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
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
    index("collections_workspaceId_idx").on(table.workspaceId),
    uniqueIndex("collections_workspaceId_slug_uidx").on(
      table.workspaceId,
      table.slug
    ),
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
    orderIndex: integer("order_index").default(0),
    addedAt: timestamp("added_at").defaultNow(),
  },
  (table) => [
    index("collectionPosts_collectionId_idx").on(table.collectionId),
    index("collectionPosts_postId_idx").on(table.postId),
    uniqueIndex("collectionPosts_collectionId_postId_uidx").on(
      table.collectionId,
      table.postId
    ),
  ]
);

export const series = pgTable(
  "series",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    collectionId: text("collection_id").references(() => collections.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    orderIndex: integer("order_index").default(0),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("series_workspaceId_idx").on(table.workspaceId),
    index("series_collectionId_idx").on(table.collectionId),
    uniqueIndex("series_workspaceId_slug_uidx").on(
      table.workspaceId,
      table.slug
    ),
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
    orderIndex: integer("order_index").default(0),
    addedAt: timestamp("added_at").defaultNow(),
  },
  (table) => [
    index("seriesPosts_seriesId_idx").on(table.seriesId),
    index("seriesPosts_postId_idx").on(table.postId),
    uniqueIndex("seriesPosts_seriesId_postId_uidx").on(
      table.seriesId,
      table.postId
    ),
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
  contentTemplates: many(contentTemplates),
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
}));

export const styleSettingsRelations = relations(styleSettings, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [styleSettings.workspaceId],
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

export const postsRelations = relations(posts, ({ one }) => ({
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
  writingStyleProfile: one(writingStyleProfiles, {
    fields: [posts.styleProfileUsed],
    references: [writingStyleProfiles.id],
  }),
  automationRuns: many(automationRuns),
  revisions: many(postRevisions),
  conversations: many(postConversations),
  collectionPosts: many(collectionPosts),
  seriesPosts: many(seriesPosts),
}));

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

export const seriesRelations = relations(series, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [series.workspaceId],
    references: [workspaces.id],
  }),
  collection: one(collections, {
    fields: [series.collectionId],
    references: [collections.id],
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
