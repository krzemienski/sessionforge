import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  githubCommits,
  githubPullRequests,
  githubRepositories,
  githubPrivacySettings,
} from "@sessionforge/db";
import { eq, desc, and, notInArray } from "drizzle-orm";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const workspaceSlug = searchParams.get("workspace");
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  if (!workspaceSlug) {
    return NextResponse.json({ error: "workspace query param required" }, { status: 400 });
  }

  const { workspace } = await getAuthorizedWorkspace(
    session,
    workspaceSlug,
    PERMISSIONS.INTEGRATIONS_READ
  );

  // Get privacy exclusions
  const exclusions = await db.query.githubPrivacySettings.findMany({
    where: and(
      eq(githubPrivacySettings.workspaceId, workspace.id),
      eq(githubPrivacySettings.excludeFromContent, true)
    ),
  });

  const excludedRepoIds = exclusions
    .filter((e) => e.repositoryId !== null && e.commitSha === null)
    .map((e) => e.repositoryId as string);

  const excludedCommitShas = exclusions
    .filter((e) => e.commitSha !== null)
    .map((e) => e.commitSha as string);

  // Build query conditions for commits
  const commitConditions = [eq(githubRepositories.workspaceId, workspace.id)];
  if (excludedCommitShas.length > 0) {
    commitConditions.push(notInArray(githubCommits.commitSha, excludedCommitShas));
  }

  // Fetch recent commits (excluding privacy-excluded ones)
  const commits = await db
    .select({
      id: githubCommits.id,
      sha: githubCommits.commitSha,
      message: githubCommits.message,
      authorName: githubCommits.authorName,
      authorEmail: githubCommits.authorEmail,
      authorDate: githubCommits.authorDate,
      url: githubCommits.commitUrl,
      repoName: githubRepositories.repoName,
      repoUrl: githubRepositories.repoUrl,
      repositoryId: githubRepositories.id,
    })
    .from(githubCommits)
    .innerJoin(
      githubRepositories,
      eq(githubCommits.repositoryId, githubRepositories.id)
    )
    .where(and(...commitConditions))
    .orderBy(desc(githubCommits.authorDate))
    .limit(limit);

  // Filter out commits from excluded repositories
  const allowedCommits = excludedRepoIds.length > 0
    ? commits.filter((c) => !excludedRepoIds.includes(c.repositoryId))
    : commits;

  // Fetch recent PRs (excluding from excluded repos)
  const pullRequests = await db
    .select({
      id: githubPullRequests.id,
      number: githubPullRequests.prNumber,
      title: githubPullRequests.title,
      body: githubPullRequests.body,
      state: githubPullRequests.state,
      authorName: githubPullRequests.authorName,
      url: githubPullRequests.prUrl,
      mergedAt: githubPullRequests.mergedAt,
      createdAt: githubPullRequests.createdAtGithub,
      repoName: githubRepositories.repoName,
      repoUrl: githubRepositories.repoUrl,
      repositoryId: githubRepositories.id,
    })
    .from(githubPullRequests)
    .innerJoin(
      githubRepositories,
      eq(githubPullRequests.repositoryId, githubRepositories.id)
    )
    .where(eq(githubRepositories.workspaceId, workspace.id))
    .orderBy(desc(githubPullRequests.createdAtGithub))
    .limit(limit);

  // Filter out PRs from excluded repositories
  const allowedPRs = excludedRepoIds.length > 0
    ? pullRequests.filter((pr) => !excludedRepoIds.includes(pr.repositoryId))
    : pullRequests;

  // Combine and sort by date
  const activity = [
    ...allowedCommits.map((c) => ({
      type: "commit" as const,
      ...c,
      date: c.authorDate,
    })),
    ...allowedPRs.map((pr) => ({
      type: "pull_request" as const,
      ...pr,
      date: pr.createdAt,
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit);

  return NextResponse.json({ activity });
}
