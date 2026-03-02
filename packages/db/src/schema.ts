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
        | "manual";
    }>(),
    toneUsed: toneProfileEnum("tone_used"),
    wordCount: integer("word_count"),
    aiDraftMarkdown: text("ai_draft_markdown"),
    editDistance: integer("edit_distance"),
    styleProfileUsed: text("style_profile_used"),
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
