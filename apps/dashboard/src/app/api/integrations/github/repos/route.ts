import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { githubIntegrations, githubRepositories, workspaces } from "@sessionforge/db";
import { eq, and } from "drizzle-orm";
import {
  fetchGitHubRepositories,
  fetchGitHubRepository,
  GitHubApiError,
} from "@/lib/integrations/github";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const workspaceSlug = searchParams.get("workspace");
  const refresh = searchParams.get("refresh") === "true";

  if (!workspaceSlug) {
    return NextResponse.json({ error: "workspace query param required" }, { status: 400 });
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, workspaceSlug),
  });

  if (!workspace || workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const integration = await db.query.githubIntegrations.findFirst({
    where: eq(githubIntegrations.workspaceId, workspace.id),
  });

  if (!integration) {
    return NextResponse.json({ error: "GitHub integration not found" }, { status: 404 });
  }

  const connectedRepos = await db.query.githubRepositories.findMany({
    where: eq(githubRepositories.workspaceId, workspace.id),
    columns: {
      id: true,
      githubRepoId: true,
      repoName: true,
      repoUrl: true,
      defaultBranch: true,
      lastSyncedAt: true,
      createdAt: true,
    },
  });

  if (refresh) {
    try {
      const allRepos = await fetchGitHubRepositories(integration.accessToken);
      return NextResponse.json({
        connected: connectedRepos,
        available: allRepos.map((repo) => ({
          id: repo.id,
          name: repo.full_name,
          description: repo.description,
          url: repo.html_url,
          defaultBranch: repo.default_branch,
          private: repo.private,
          owner: repo.owner.login,
          updatedAt: repo.updated_at,
        })),
      });
    } catch (error) {
      if (error instanceof GitHubApiError) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.status === 401 ? 400 : error.status }
        );
      }
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to fetch repositories from GitHub" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ connected: connectedRepos });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { workspaceSlug, owner, repo } = body;

  if (!workspaceSlug || !owner || !repo) {
    return NextResponse.json(
      { error: "workspaceSlug, owner, and repo are required" },
      { status: 400 }
    );
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, workspaceSlug),
  });

  if (!workspace || workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const integration = await db.query.githubIntegrations.findFirst({
    where: eq(githubIntegrations.workspaceId, workspace.id),
  });

  if (!integration) {
    return NextResponse.json({ error: "GitHub integration not found" }, { status: 404 });
  }

  try {
    const repoData = await fetchGitHubRepository(integration.accessToken, owner, repo);

    const existingRepo = await db.query.githubRepositories.findFirst({
      where: and(
        eq(githubRepositories.workspaceId, workspace.id),
        eq(githubRepositories.githubRepoId, repoData.id)
      ),
    });

    if (existingRepo) {
      return NextResponse.json(
        { error: "Repository already connected" },
        { status: 409 }
      );
    }

    const [newRepo] = await db
      .insert(githubRepositories)
      .values({
        workspaceId: workspace.id,
        integrationId: integration.id,
        githubRepoId: repoData.id,
        repoName: repoData.full_name,
        repoUrl: repoData.html_url,
        defaultBranch: repoData.default_branch,
      })
      .returning({
        id: githubRepositories.id,
        repoName: githubRepositories.repoName,
        repoUrl: githubRepositories.repoUrl,
        defaultBranch: githubRepositories.defaultBranch,
        createdAt: githubRepositories.createdAt,
      });

    return NextResponse.json(
      { connected: true, repository: newRepo },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof GitHubApiError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status === 401 ? 400 : error.status }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to connect repository" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const workspaceSlug = searchParams.get("workspace");
  const repoId = searchParams.get("repoId");

  if (!workspaceSlug || !repoId) {
    return NextResponse.json({ error: "workspace and repoId query params required" }, { status: 400 });
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, workspaceSlug),
  });

  if (!workspace || workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const existing = await db.query.githubRepositories.findFirst({
    where: and(
      eq(githubRepositories.workspaceId, workspace.id),
      eq(githubRepositories.id, repoId)
    ),
  });

  if (!existing) {
    return NextResponse.json({ error: "Repository not found" }, { status: 404 });
  }

  await db
    .delete(githubRepositories)
    .where(
      and(
        eq(githubRepositories.workspaceId, workspace.id),
        eq(githubRepositories.id, repoId)
      )
    );

  return NextResponse.json({ disconnected: true });
}
