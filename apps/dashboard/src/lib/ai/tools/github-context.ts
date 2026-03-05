import { db } from "@/lib/db";
import {
  githubRepositories,
  githubCommits,
  githubPullRequests,
  githubIssues,
  claudeSessions,
  githubPrivacySettings,
} from "@sessionforge/db";
import { eq, desc, and, like, or, gte, lte, notInArray, isNull } from "drizzle-orm";

export interface GitHubCommit {
  commitSha: string;
  message: string;
  authorName: string | null;
  authorEmail: string | null;
  authorDate: string;
  commitUrl: string;
  additions: number | null;
  deletions: number | null;
  filesChanged: string[];
  repositoryName: string;
}

export interface GitHubPullRequest {
  prNumber: number;
  title: string;
  body: string | null;
  state: string;
  authorName: string | null;
  prUrl: string;
  mergedAt: string | null;
  createdAt: string;
  repositoryName: string;
}

export interface GitHubIssue {
  issueNumber: number;
  title: string;
  body: string | null;
  state: string;
  authorName: string | null;
  issueUrl: string;
  createdAt: string;
  closedAt: string | null;
  repositoryName: string;
}

/**
 * Helper function to get excluded repository IDs and commit SHAs for a workspace
 */
async function getPrivacyExclusions(workspaceId: string): Promise<{
  excludedRepoIds: string[];
  excludedCommitShas: string[];
}> {
  const exclusions = await db.query.githubPrivacySettings.findMany({
    where: and(
      eq(githubPrivacySettings.workspaceId, workspaceId),
      eq(githubPrivacySettings.excludeFromContent, true)
    ),
  });

  const excludedRepoIds = exclusions
    .filter((e) => e.repositoryId !== null && e.commitSha === null)
    .map((e) => e.repositoryId as string);

  const excludedCommitShas = exclusions
    .filter((e) => e.commitSha !== null)
    .map((e) => e.commitSha as string);

  return { excludedRepoIds, excludedCommitShas };
}

// Tool implementations — called by MCP tool handlers
export async function getGitHubCommitsForSession(
  workspaceId: string,
  sessionId: string,
  limit = 50
): Promise<GitHubCommit[]> {
  // Find the session to get the project path
  const session = await db.query.claudeSessions.findFirst({
    where: and(
      eq(claudeSessions.sessionId, sessionId),
      eq(claudeSessions.workspaceId, workspaceId)
    ),
  });

  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  // Find repositories that match the session's project path
  // Match by repo name contained in project path
  const repos = await db.query.githubRepositories.findMany({
    where: eq(githubRepositories.workspaceId, workspaceId),
  });

  const matchingRepos = repos.filter((repo) => {
    const repoName = repo.repoName.split("/").pop() ?? repo.repoName;
    return session.projectPath.toLowerCase().includes(repoName.toLowerCase());
  });

  if (matchingRepos.length === 0) {
    return [];
  }

  // Get privacy exclusions
  const { excludedRepoIds, excludedCommitShas } = await getPrivacyExclusions(
    workspaceId
  );

  // Filter out excluded repositories
  const allowedRepos = matchingRepos.filter(
    (r) => !excludedRepoIds.includes(r.id)
  );

  if (allowedRepos.length === 0) {
    return [];
  }

  // Build query conditions
  const conditions = [
    or(...allowedRepos.map((r) => eq(githubCommits.repositoryId, r.id))),
    gte(githubCommits.authorDate, session.startedAt),
  ];

  // Add timeframe filter
  if (session.endedAt) {
    conditions.push(
      lte(githubCommits.authorDate, new Date(session.endedAt.getTime() + 3600000))
    );
  }

  // Exclude specific commits
  if (excludedCommitShas.length > 0) {
    conditions.push(notInArray(githubCommits.commitSha, excludedCommitShas));
  }

  // Get commits from matching repositories within the session timeframe
  const commits = await db.query.githubCommits.findMany({
    where: and(...conditions),
    orderBy: desc(githubCommits.authorDate),
    limit,
  });

  return commits.map((c) => {
    const repo = allowedRepos.find((r) => r.id === c.repositoryId);
    return {
      commitSha: c.commitSha,
      message: c.message,
      authorName: c.authorName,
      authorEmail: c.authorEmail,
      authorDate: c.authorDate.toISOString(),
      commitUrl: c.commitUrl,
      additions: c.additions,
      deletions: c.deletions,
      filesChanged: (c.filesChanged as string[]) ?? [],
      repositoryName: repo?.repoName ?? "unknown",
    };
  });
}

export async function getPullRequestById(
  workspaceId: string,
  repositoryName: string,
  prNumber: number
): Promise<GitHubPullRequest> {
  // Find the repository
  const repo = await db.query.githubRepositories.findFirst({
    where: and(
      eq(githubRepositories.workspaceId, workspaceId),
      like(githubRepositories.repoName, `%${repositoryName}%`)
    ),
  });

  if (!repo) {
    throw new Error(
      `Repository matching "${repositoryName}" not found in workspace`
    );
  }

  // Find the PR
  const pr = await db.query.githubPullRequests.findFirst({
    where: and(
      eq(githubPullRequests.repositoryId, repo.id),
      eq(githubPullRequests.prNumber, prNumber)
    ),
  });

  if (!pr) {
    throw new Error(`Pull request #${prNumber} not found in ${repo.repoName}`);
  }

  return {
    prNumber: pr.prNumber,
    title: pr.title,
    body: pr.body,
    state: pr.state,
    authorName: pr.authorName,
    prUrl: pr.prUrl,
    mergedAt: pr.mergedAt?.toISOString() ?? null,
    createdAt: pr.createdAtGithub.toISOString(),
    repositoryName: repo.repoName,
  };
}

export async function getRecentCommits(
  workspaceId: string,
  lookbackDays: number,
  repositoryFilter?: string,
  limit = 50
): Promise<GitHubCommit[]> {
  const since = new Date();
  since.setDate(since.getDate() - lookbackDays);

  // Get privacy exclusions
  const { excludedRepoIds, excludedCommitShas } = await getPrivacyExclusions(
    workspaceId
  );

  // Get all repositories for the workspace
  let repos = await db.query.githubRepositories.findMany({
    where: eq(githubRepositories.workspaceId, workspaceId),
  });

  if (repositoryFilter) {
    repos = repos.filter((r) =>
      r.repoName.toLowerCase().includes(repositoryFilter.toLowerCase())
    );
  }

  // Filter out excluded repositories
  repos = repos.filter((r) => !excludedRepoIds.includes(r.id));

  if (repos.length === 0) {
    return [];
  }

  // Build query conditions
  const conditions = [
    or(...repos.map((r) => eq(githubCommits.repositoryId, r.id))),
    gte(githubCommits.authorDate, since),
  ];

  // Exclude specific commits
  if (excludedCommitShas.length > 0) {
    conditions.push(notInArray(githubCommits.commitSha, excludedCommitShas));
  }

  const commits = await db.query.githubCommits.findMany({
    where: and(...conditions),
    orderBy: desc(githubCommits.authorDate),
    limit,
  });

  return commits.map((c) => {
    const repo = repos.find((r) => r.id === c.repositoryId);
    return {
      commitSha: c.commitSha,
      message: c.message,
      authorName: c.authorName,
      authorEmail: c.authorEmail,
      authorDate: c.authorDate.toISOString(),
      commitUrl: c.commitUrl,
      additions: c.additions,
      deletions: c.deletions,
      filesChanged: (c.filesChanged as string[]) ?? [],
      repositoryName: repo?.repoName ?? "unknown",
    };
  });
}

export async function searchGitHubIssues(
  workspaceId: string,
  searchTerm: string,
  state?: "open" | "closed" | "all",
  limit = 20
): Promise<GitHubIssue[]> {
  // Get all repositories for the workspace
  const repos = await db.query.githubRepositories.findMany({
    where: eq(githubRepositories.workspaceId, workspaceId),
  });

  if (repos.length === 0) {
    return [];
  }

  const conditions = [
    or(...repos.map((r) => eq(githubIssues.repositoryId, r.id))),
    or(
      like(githubIssues.title, `%${searchTerm}%`),
      like(githubIssues.body, `%${searchTerm}%`)
    ),
  ];

  if (state && state !== "all") {
    conditions.push(eq(githubIssues.state, state));
  }

  const issues = await db.query.githubIssues.findMany({
    where: and(...conditions),
    orderBy: desc(githubIssues.createdAtGithub),
    limit,
  });

  return issues.map((i) => {
    const repo = repos.find((r) => r.id === i.repositoryId);
    return {
      issueNumber: i.issueNumber,
      title: i.title,
      body: i.body,
      state: i.state,
      authorName: i.authorName,
      issueUrl: i.issueUrl,
      createdAt: i.createdAtGithub.toISOString(),
      closedAt: i.closedAt?.toISOString() ?? null,
      repositoryName: repo?.repoName ?? "unknown",
    };
  });
}

// MCP tool definitions for use with Anthropic SDK tool_use
export const githubContextTools = [
  {
    name: "get_github_commits_for_session",
    description:
      "Retrieve GitHub commits associated with a Claude session by matching the session's project path to connected repositories. Returns commits made during or shortly after the session timeframe.",
    input_schema: {
      type: "object" as const,
      properties: {
        sessionId: {
          type: "string",
          description: "The session ID to fetch GitHub commits for",
        },
        limit: {
          type: "number",
          description: "Maximum number of commits to return (default: 50)",
        },
      },
      required: ["sessionId"],
    },
  },
  {
    name: "get_pull_request_by_id",
    description:
      "Get detailed information about a specific GitHub pull request by repository name and PR number.",
    input_schema: {
      type: "object" as const,
      properties: {
        repositoryName: {
          type: "string",
          description:
            "Repository name (can be partial match, e.g., 'sessionforge' or 'owner/sessionforge')",
        },
        prNumber: {
          type: "number",
          description: "Pull request number",
        },
      },
      required: ["repositoryName", "prNumber"],
    },
  },
  {
    name: "get_recent_commits",
    description:
      "Get recent GitHub commits from connected repositories within a lookback window, optionally filtered by repository name.",
    input_schema: {
      type: "object" as const,
      properties: {
        lookbackDays: {
          type: "number",
          description: "Number of days to look back for commits",
        },
        repositoryFilter: {
          type: "string",
          description: "Optional repository name filter (partial match)",
        },
        limit: {
          type: "number",
          description: "Maximum number of commits to return (default: 50)",
        },
      },
      required: ["lookbackDays"],
    },
  },
  {
    name: "search_github_issues",
    description:
      "Search GitHub issues across connected repositories by title or body content. Optionally filter by issue state (open, closed, or all).",
    input_schema: {
      type: "object" as const,
      properties: {
        searchTerm: {
          type: "string",
          description: "Search term to match against issue titles and bodies",
        },
        state: {
          type: "string",
          enum: ["open", "closed", "all"],
          description:
            "Filter by issue state (default: all). Use 'open', 'closed', or 'all'",
        },
        limit: {
          type: "number",
          description: "Maximum number of issues to return (default: 20)",
        },
      },
      required: ["searchTerm"],
    },
  },
];

export async function handleGitHubContextTool(
  workspaceId: string,
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<unknown> {
  switch (toolName) {
    case "get_github_commits_for_session":
      return getGitHubCommitsForSession(
        workspaceId,
        toolInput.sessionId as string,
        toolInput.limit as number | undefined
      );

    case "get_pull_request_by_id":
      return getPullRequestById(
        workspaceId,
        toolInput.repositoryName as string,
        toolInput.prNumber as number
      );

    case "get_recent_commits":
      return getRecentCommits(
        workspaceId,
        toolInput.lookbackDays as number,
        toolInput.repositoryFilter as string | undefined,
        toolInput.limit as number | undefined
      );

    case "search_github_issues":
      return searchGitHubIssues(
        workspaceId,
        toolInput.searchTerm as string,
        toolInput.state as "open" | "closed" | "all" | undefined,
        toolInput.limit as number | undefined
      );

    default:
      throw new Error(`Unknown GitHub context tool: ${toolName}`);
  }
}
