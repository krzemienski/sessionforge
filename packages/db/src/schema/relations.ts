import { relations } from "drizzle-orm";
import {
  accounts,
  agentRuns,
  apiKeys,
  approvalDecisions,
  approvalWorkflows,
  authSessions,
  automationRuns,
  backupBundles,
  batchJobs,
  claudeSessions,
  collectionPosts,
  collections,
  contentAssets,
  contentRecommendations,
  contentTemplates,
  contentTriggers,
  devtoIntegrations,
  devtoPublications,
  engagementMetrics,
  experimentResults,
  experimentVariants,
  experiments,
  ghostIntegrations,
  ghostPublications,
  githubCommits,
  githubIntegrations,
  githubIssues,
  githubPrivacySettings,
  githubPullRequests,
  githubRepositories,
  insights,
  integrationHealthChecks,
  linkedinIntegrations,
  linkedinPublications,
  mediumIntegrations,
  mediumPublications,
  portfolioSettings,
  postConversations,
  postPerformanceMetrics,
  postReviewers,
  postRevisions,
  postStyleMetrics,
  posts,
  recommendationFeedback,
  researchItems,
  riskFlagResolutions,
  scanSources,
  scheduledPublications,
  series,
  seriesPosts,
  sessionBookmarks,
  socialAnalytics,
  styleSettings,
  subscriptions,
  supplementaryContent,
  twitterIntegrations,
  twitterPublications,
  usageEvents,
  usageMonthlySummary,
  users,
  webhookEndpoints,
  workspaceActivity,
  workspaceInvites,
  workspaceMembers,
  workspaces,
  writingSkills,
  writingStyleProfiles,
} from "./tables";

export const webhookEndpointsRelations = relations(webhookEndpoints, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [webhookEndpoints.workspaceId],
    references: [workspaces.id],
  }),
}));

export const writingSkillsRelations = relations(writingSkills, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [writingSkills.workspaceId],
    references: [workspaces.id],
  }),
}));

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
  postReviewAssignments: many(postReviewers, {
    relationName: "reviewerUser",
  }),
  postReviewsAssigned: many(postReviewers, {
    relationName: "reviewerAssigner",
  }),
  approvalDecisions: many(approvalDecisions),
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
  experiments: many(experiments),
  approvalWorkflow: one(approvalWorkflows),
}));

export const styleSettingsRelations = relations(styleSettings, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [styleSettings.workspaceId],
    references: [workspaces.id],
  }),
}));

export const approvalWorkflowsRelations = relations(approvalWorkflows, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [approvalWorkflows.workspaceId],
    references: [workspaces.id],
  }),
}));

export const postReviewersRelations = relations(postReviewers, ({ one }) => ({
  post: one(posts, {
    fields: [postReviewers.postId],
    references: [posts.id],
  }),
  user: one(users, {
    fields: [postReviewers.userId],
    references: [users.id],
    relationName: "reviewerUser",
  }),
  assigner: one(users, {
    fields: [postReviewers.assignedBy],
    references: [users.id],
    relationName: "reviewerAssigner",
  }),
}));

export const approvalDecisionsRelations = relations(approvalDecisions, ({ one }) => ({
  post: one(posts, {
    fields: [approvalDecisions.postId],
    references: [posts.id],
  }),
  reviewer: one(users, {
    fields: [approvalDecisions.reviewerId],
    references: [users.id],
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
  reviewers: many(postReviewers),
  experiments: many(experiments),
  approvalDecisions: many(approvalDecisions),
  researchItems: many(researchItems),
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

export const researchItemsRelations = relations(researchItems, ({ one }) => ({
  post: one(posts, {
    fields: [researchItems.postId],
    references: [posts.id],
  }),
  workspace: one(workspaces, {
    fields: [researchItems.workspaceId],
    references: [workspaces.id],
  }),
  session: one(claudeSessions, {
    fields: [researchItems.sessionId],
    references: [claudeSessions.id],
  }),
}));

export const integrationHealthChecksRelations = relations(
  integrationHealthChecks,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [integrationHealthChecks.workspaceId],
      references: [workspaces.id],
    }),
  })
);

export const backupBundlesRelations = relations(backupBundles, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [backupBundles.workspaceId],
    references: [workspaces.id],
  }),
  createdByUser: one(users, {
    fields: [backupBundles.createdBy],
    references: [users.id],
  }),
}));

export const experimentsRelations = relations(experiments, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [experiments.workspaceId],
    references: [workspaces.id],
  }),
  post: one(posts, {
    fields: [experiments.postId],
    references: [posts.id],
  }),
  variants: many(experimentVariants),
}));

export const experimentVariantsRelations = relations(
  experimentVariants,
  ({ one, many }) => ({
    experiment: one(experiments, {
      fields: [experimentVariants.experimentId],
      references: [experiments.id],
    }),
    results: many(experimentResults),
  })
);

export const experimentResultsRelations = relations(
  experimentResults,
  ({ one }) => ({
    variant: one(experimentVariants, {
      fields: [experimentResults.variantId],
      references: [experimentVariants.id],
    }),
  })
);
