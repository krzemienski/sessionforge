import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  githubIntegrations,
  githubRepositories,
  githubCommits,
  githubPullRequests,
  githubIssues,
  workspaces,
} from "@sessionforge/db";
import { eq, and } from "drizzle-orm";
import {
  fetchGitHubCommits,
  fetchGitHubPullRequests,
  fetchGitHubIssues,
  GitHubApiError,
} from "@/lib/integrations/github";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { workspaceSlug, repoId } = body;

  if (!workspaceSlug || !repoId) {
    return NextResponse.json(
      { error: "workspaceSlug and repoId are required" },
      { status: 400 }
    );
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, workspaceSlug),
  });

  if (!workspace || workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const repository = await db.query.githubRepositories.findFirst({
    where: and(
      eq(githubRepositories.workspaceId, workspace.id),
      eq(githubRepositories.id, repoId)
    ),
  });

  if (!repository) {
    return NextResponse.json({ error: "Repository not found" }, { status: 404 });
  }

  const integration = await db.query.githubIntegrations.findFirst({
    where: eq(githubIntegrations.id, repository.integrationId),
  });

  if (!integration) {
    return NextResponse.json({ error: "GitHub integration not found" }, { status: 404 });
  }

  try {
    // Extract owner and repo from the repo name (format: "owner/repo")
    const [owner, repo] = repository.repoName.split("/");

    if (!owner || !repo) {
      return NextResponse.json(
        { error: "Invalid repository name format" },
        { status: 400 }
      );
    }

    // Fetch data from GitHub
    const [commits, pullRequests, issues] = await Promise.all([
      fetchGitHubCommits(integration.accessToken, owner, repo, { per_page: 100 }),
      fetchGitHubPullRequests(integration.accessToken, owner, repo, { state: "all", per_page: 100 }),
      fetchGitHubIssues(integration.accessToken, owner, repo, { state: "all", per_page: 100 }),
    ]);

    // Sync commits
    let syncedCommits = 0;
    for (const commit of commits) {
      await db
        .insert(githubCommits)
        .values({
          repositoryId: repository.id,
          commitSha: commit.sha,
          message: commit.commit.message,
          authorName: commit.commit.author.name,
          authorEmail: commit.commit.author.email,
          authorDate: new Date(commit.commit.author.date),
          commitUrl: commit.html_url,
        })
        .onConflictDoNothing();
      syncedCommits++;
    }

    // Sync pull requests
    let syncedPRs = 0;
    for (const pr of pullRequests) {
      await db
        .insert(githubPullRequests)
        .values({
          repositoryId: repository.id,
          prNumber: pr.number,
          title: pr.title,
          body: pr.body,
          state: pr.state,
          authorName: pr.user.login,
          prUrl: pr.html_url,
          mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
          createdAtGithub: new Date(pr.created_at),
        })
        .onConflictDoUpdate({
          target: [githubPullRequests.repositoryId, githubPullRequests.prNumber],
          set: {
            title: pr.title,
            body: pr.body,
            state: pr.state,
            mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
            updatedAt: new Date(),
          },
        });
      syncedPRs++;
    }

    // Sync issues (filter out pull requests as GitHub API returns PRs as issues)
    const actualIssues = issues.filter((issue) => !("pull_request" in issue));
    let syncedIssues = 0;
    for (const issue of actualIssues) {
      await db
        .insert(githubIssues)
        .values({
          repositoryId: repository.id,
          issueNumber: issue.number,
          title: issue.title,
          body: issue.body,
          state: issue.state,
          authorName: issue.user.login,
          issueUrl: issue.html_url,
          createdAtGithub: new Date(issue.created_at),
          closedAt: issue.closed_at ? new Date(issue.closed_at) : null,
        })
        .onConflictDoUpdate({
          target: [githubIssues.repositoryId, githubIssues.issueNumber],
          set: {
            title: issue.title,
            body: issue.body,
            state: issue.state,
            closedAt: issue.closed_at ? new Date(issue.closed_at) : null,
            updatedAt: new Date(),
          },
        });
      syncedIssues++;
    }

    // Update repository's lastSyncedAt
    await db
      .update(githubRepositories)
      .set({ lastSyncedAt: new Date() })
      .where(eq(githubRepositories.id, repository.id));

    return NextResponse.json({
      synced: true,
      stats: {
        commits: syncedCommits,
        pullRequests: syncedPRs,
        issues: syncedIssues,
      },
      lastSyncedAt: new Date(),
    });
  } catch (error) {
    if (error instanceof GitHubApiError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status === 401 ? 400 : error.status }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync GitHub data" },
      { status: 500 }
    );
  }
}
