/**
 * Comprehensive shared @sessionforge/db mock for bun:test cross-file compatibility.
 *
 * bun:test mock.module() is process-wide — when multiple test files mock the
 * same module, only one factory "wins." This creates a shared mutable mock
 * object that includes ALL commonly-used exports from @sessionforge/db, so
 * whichever test file registers first, every other file's imports still resolve.
 *
 * Usage in test files:
 *   import { SHARED_SCHEMA_MOCK } from "@/__test-utils__/shared-schema-mock";
 *   mock.module("@sessionforge/db", () => SHARED_SCHEMA_MOCK);
 *
 * Files can override specific fields after importing:
 *   const myMock = { ...SHARED_SCHEMA_MOCK, posts: { ...SHARED_SCHEMA_MOCK.posts, myField: "val" } };
 *   mock.module("@sessionforge/db", () => myMock);
 */

const enumStub = (values: string[] = []) => ({
  enumValues: values,
});

const tableStub = (fields: Record<string, string> = {}) => ({
  ...fields,
});

/**
 * Mutable mock containing ALL table + enum exports from @sessionforge/db.
 *
 * Field names use short stubs (e.g., "p_id", "ws_slug") — the mock DB's
 * `eq()` / `desc()` helpers are also mocked and never inspect these values.
 * Files that need specific field shapes can spread-override individual tables.
 */
export const SHARED_SCHEMA_MOCK: Record<string, unknown> = {
  // ── Tables ────────────────────────────────────────────────────────────────
  users: tableStub({ id: "u_id", email: "u_email", name: "u_name" }),
  accounts: tableStub({ id: "a_id" }),
  authSessions: tableStub({ id: "as_id" }),
  verifications: tableStub({ id: "v_id" }),

  workspaces: tableStub({ id: "ws_id", slug: "ws_slug", ownerId: "ws_ownerId" }),
  workspaceMembers: tableStub({ id: "wm_id", workspaceId: "wm_wsId" }),
  workspaceInvites: tableStub({ id: "wi_id", workspaceId: "wi_wsId" }),
  workspaceActivity: tableStub({ id: "wa_id", workspaceId: "wa_wsId" }),

  styleSettings: tableStub({ id: "st_id", workspaceId: "st_wsId" }),
  integrationSettings: tableStub({ id: "is_id", workspaceId: "is_wsId" }),
  platformSettings: tableStub({ id: "ps_id" }),

  claudeSessions: tableStub({
    id: "cs_id",
    sessionId: "cs_sessionId",
    workspaceId: "cs_workspaceId",
    projectPath: "cs_projectPath",
    projectName: "cs_projectName",
    filePath: "cs_filePath",
    messageCount: "cs_messageCount",
    toolsUsed: "cs_toolsUsed",
    filesModified: "cs_filesModified",
    errorsEncountered: "cs_errorsEncountered",
    costUsd: "cs_costUsd",
    startedAt: "cs_startedAt",
    endedAt: "cs_endedAt",
    durationSeconds: "cs_durationSeconds",
    scannedAt: "cs_scannedAt",
  }),

  insights: tableStub({
    id: "i_id",
    title: "i_title",
    category: "i_category",
    compositeScore: "i_compositeScore",
    workspaceId: "i_workspaceId",
    sessionId: "i_sessionId",
    createdAt: "i_createdAt",
  }),

  posts: tableStub({
    id: "p_id",
    workspaceId: "p_workspaceId",
    parentPostId: "p_parentPostId",
    createdAt: "p_createdAt",
    updatedAt: "p_updatedAt",
    title: "p_title",
    markdown: "p_markdown",
    contentType: "p_contentType",
    status: "p_status",
    platformFooterEnabled: "p_platformFooterEnabled",
    toneUsed: "p_toneUsed",
  }),
  postRevisions: tableStub({ id: "pr_id", postId: "pr_postId" }),
  postConversations: tableStub({ id: "pc_id" }),

  contentTriggers: tableStub({
    id: "ct_id",
    workspaceId: "ct_workspaceId",
    name: "ct_name",
    triggerType: "ct_triggerType",
    contentType: "ct_contentType",
    lookbackWindow: "ct_lookbackWindow",
    cronExpression: "ct_cronExpression",
    debounceMinutes: "ct_debounceMinutes",
    qstashScheduleId: "ct_qstashScheduleId",
    watchStatus: "ct_watchStatus",
    lastRunAt: "ct_lastRunAt",
    lastRunStatus: "ct_lastRunStatus",
  }),

  scanSources: tableStub({ id: "ss_id", workspaceId: "ss_wsId" }),
  apiKeys: tableStub({ id: "ak_id" }),
  sessionBookmarks: tableStub({ id: "sb_id" }),
  contentMetrics: tableStub({ id: "cm_id" }),

  writingStyleProfiles: tableStub({ id: "wsp_id", workspaceId: "wsp_wsId" }),
  writingSkills: tableStub({ id: "wsk_id" }),

  agentRuns: tableStub({ id: "ar_id", workspaceId: "ar_wsId" }),
  agentEvents: tableStub({ id: "ae_id" }),

  automationRuns: tableStub({
    id: "arun_id",
    status: "arun_status",
    sessionsScanned: "arun_sessionsScanned",
    insightsExtracted: "arun_insightsExtracted",
    postId: "arun_postId",
    completedAt: "arun_completedAt",
    durationMs: "arun_durationMs",
    errorMessage: "arun_errorMessage",
  }),

  webhookEndpoints: tableStub({
    id: "we_id",
    workspaceId: "we_workspaceId",
    events: "we_events",
    isActive: "we_isActive",
    url: "we_url",
    secret: "we_secret",
  }),

  devtoIntegrations: tableStub({ workspaceId: "dti_workspaceId" }),
  devtoPublications: tableStub({ id: "dp_id" }),
  ghostIntegrations: tableStub({ id: "gi_id" }),
  ghostPublications: tableStub({ id: "gp_id" }),
  mediumIntegrations: tableStub({ id: "mi_id" }),
  mediumPublications: tableStub({ id: "mp_id" }),
  linkedinIntegrations: tableStub({ id: "li_id" }),
  linkedinPublications: tableStub({ id: "lp_id" }),
  twitterIntegrations: tableStub({ id: "ti_id" }),
  twitterPublications: tableStub({ id: "tp_id" }),
  wordpressConnections: tableStub({ id: "wc_id" }),
  scheduledPublications: tableStub({ id: "sp_id" }),

  subscriptions: tableStub({ id: "sub_id" }),
  usageEvents: tableStub({ id: "ue_id" }),
  usageMonthlySummary: tableStub({ id: "ums_id" }),

  contentTemplates: tableStub({ id: "ctpl_id" }),
  contentRecommendations: tableStub({ id: "cr_id" }),
  contentAssets: tableStub({ id: "ca_id" }),
  supplementaryContent: tableStub({ id: "sc_id" }),

  collections: tableStub({ id: "col_id" }),
  collectionPosts: tableStub({ id: "cp_id" }),
  series: tableStub({ id: "ser_id" }),
  seriesPosts: tableStub({ id: "sp_id" }),

  engagementMetrics: tableStub({ id: "em_id" }),
  socialAnalytics: tableStub({ id: "sa_id" }),
  postPerformanceMetrics: tableStub({ id: "ppm_id" }),
  postStyleMetrics: tableStub({ id: "psm_id" }),

  githubIntegrations: tableStub({ id: "ghi_id" }),
  githubRepositories: tableStub({ id: "ghr_id" }),
  githubCommits: tableStub({ id: "ghc_id" }),
  githubPullRequests: tableStub({ id: "ghpr_id" }),
  githubIssues: tableStub({ id: "ghi_id" }),
  githubPrivacySettings: tableStub({ id: "ghps_id" }),

  portfolioSettings: tableStub({ id: "pf_id" }),
  batchJobs: tableStub({ id: "bj_id" }),
  onboardingFunnelEvents: tableStub({ id: "ofe_id" }),
  recommendationFeedback: tableStub({ id: "rf_id" }),

  // ── Enums ─────────────────────────────────────────────────────────────────
  toneProfileEnum: enumStub(["professional", "casual", "technical", "conversational"]),
  insightCategoryEnum: enumStub(["performance", "learning", "decision", "blocker", "achievement", "pattern"]),
  contentTypeEnum: enumStub(["linkedin_post", "twitter_thread", "newsletter", "doc_page", "changelog", "tldr"]),
  postStatusEnum: enumStub(["draft", "published", "archived"]),
  lookbackWindowEnum: enumStub(),
  pipelineSourceEnum: enumStub(),
  triggerTypeEnum: enumStub(),
  workspaceMemberRoleEnum: enumStub(),
  agentTypeEnum: enumStub(),
  agentRunStatusEnum: enumStub(),
  styleProfileGenerationStatusEnum: enumStub(),
  automationRunStatusEnum: enumStub(),
  planTierEnum: enumStub(),
  subscriptionStatusEnum: enumStub(),
  usageEventTypeEnum: enumStub(),
  batchJobTypeEnum: enumStub(),
  batchJobStatusEnum: enumStub(),
  templateTypeEnum: enumStub(),
  socialPlatformEnum: enumStub(),
  metricsPlatformEnum: enumStub(),
  editTypeEnum: enumStub(),
  versionTypeEnum: enumStub(),
  scheduledPublicationStatusEnum: enumStub(),
  recommendationTypeEnum: enumStub(),
  portfolioThemeEnum: enumStub(),
  contentAssetTypeEnum: enumStub(),
  feedbackActionEnum: enumStub(),
  siteThemeEnum: enumStub(),
  supplementaryTypeEnum: enumStub(),
};
