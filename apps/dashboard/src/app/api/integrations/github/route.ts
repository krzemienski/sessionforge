import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { githubIntegrations, accounts } from "@sessionforge/db";
import { eq, and } from "drizzle-orm";
import { verifyGitHubToken, GitHubApiError } from "@/lib/integrations/github";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const workspaceSlug = searchParams.get("workspace");

  if (!workspaceSlug) {
    return NextResponse.json({ error: "workspace query param required" }, { status: 400 });
  }

  const { workspace } = await getAuthorizedWorkspace(
    session,
    workspaceSlug,
    PERMISSIONS.INTEGRATIONS_READ
  );

  const integration = await db.query.githubIntegrations.findFirst({
    where: eq(githubIntegrations.workspaceId, workspace.id),
    columns: {
      id: true,
      githubUsername: true,
      enabled: true,
      createdAt: true,
    },
  });

  if (!integration) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    username: integration.githubUsername,
    enabled: integration.enabled,
    connectedAt: integration.createdAt,
  });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { workspaceSlug } = body;

  if (!workspaceSlug) {
    return NextResponse.json({ error: "workspaceSlug is required" }, { status: 400 });
  }

  const { workspace } = await getAuthorizedWorkspace(
    session,
    workspaceSlug,
    PERMISSIONS.INTEGRATIONS_MANAGE
  );

  // Get GitHub OAuth token from better-auth accounts table
  const githubAccount = await db.query.accounts.findFirst({
    where: and(
      eq(accounts.userId, session.user.id),
      eq(accounts.providerId, "github")
    ),
  });

  if (!githubAccount?.accessToken) {
    return NextResponse.json(
      { error: "No GitHub account found. Please sign in with GitHub first." },
      { status: 404 }
    );
  }

  try {
    const user = await verifyGitHubToken(githubAccount.accessToken);

    await db
      .insert(githubIntegrations)
      .values({
        workspaceId: workspace.id,
        accessToken: githubAccount.accessToken,
        githubUsername: user.login,
        enabled: true,
      })
      .onConflictDoUpdate({
        target: githubIntegrations.workspaceId,
        set: {
          accessToken: githubAccount.accessToken,
          githubUsername: user.login,
          updatedAt: new Date(),
        },
      });

    return NextResponse.json(
      { connected: true, username: user.login },
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
      { error: error instanceof Error ? error.message : "Failed to register GitHub integration" },
      { status: 500 }
    );
  }
}
