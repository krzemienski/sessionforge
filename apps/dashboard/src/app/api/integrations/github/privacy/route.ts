import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  githubPrivacySettings,
  githubRepositories,
  workspaces,
} from "@sessionforge/db";
import { eq, and } from "drizzle-orm";

/**
 * GET /api/integrations/github/privacy
 *
 * Returns privacy exclusions for a workspace
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const workspaceSlug = searchParams.get("workspace");

    if (!workspaceSlug) {
      return NextResponse.json(
        { error: "Workspace slug is required" },
        { status: 400 }
      );
    }

    // Verify workspace ownership
    const workspace = await db.query.workspaces.findFirst({
      where: and(
        eq(workspaces.slug, workspaceSlug),
        eq(workspaces.ownerId, session.user.id)
      ),
    });

    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace not found or access denied" },
        { status: 404 }
      );
    }

    // Get all privacy settings for the workspace
    const privacySettings = await db.query.githubPrivacySettings.findMany({
      where: eq(githubPrivacySettings.workspaceId, workspace.id),
      with: {
        repository: true,
      },
    });

    return NextResponse.json({
      exclusions: privacySettings.map((setting) => ({
        id: setting.id,
        repositoryId: setting.repositoryId,
        repositoryName: setting.repository?.repoName ?? null,
        commitSha: setting.commitSha,
        excludeFromContent: setting.excludeFromContent,
        createdAt: setting.createdAt,
      })),
    });
  } catch (error) {
    console.error("[GET /api/integrations/github/privacy] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch privacy settings",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/integrations/github/privacy
 *
 * Adds a privacy exclusion (repo or specific commit)
 *
 * Body:
 * - workspaceSlug: string
 * - repositoryId?: string (for repo-level exclusion)
 * - commitSha?: string (for commit-level exclusion, requires repositoryId)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { workspaceSlug, repositoryId, commitSha } = body;

    if (!workspaceSlug) {
      return NextResponse.json(
        { error: "Workspace slug is required" },
        { status: 400 }
      );
    }

    if (!repositoryId && !commitSha) {
      return NextResponse.json(
        { error: "Either repositoryId or commitSha must be provided" },
        { status: 400 }
      );
    }

    if (commitSha && !repositoryId) {
      return NextResponse.json(
        { error: "repositoryId is required when excluding a specific commit" },
        { status: 400 }
      );
    }

    // Verify workspace ownership
    const workspace = await db.query.workspaces.findFirst({
      where: and(
        eq(workspaces.slug, workspaceSlug),
        eq(workspaces.ownerId, session.user.id)
      ),
    });

    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace not found or access denied" },
        { status: 404 }
      );
    }

    // Verify repository belongs to workspace (if provided)
    if (repositoryId) {
      const repository = await db.query.githubRepositories.findFirst({
        where: and(
          eq(githubRepositories.id, repositoryId),
          eq(githubRepositories.workspaceId, workspace.id)
        ),
      });

      if (!repository) {
        return NextResponse.json(
          { error: "Repository not found or access denied" },
          { status: 404 }
        );
      }
    }

    // Check if exclusion already exists
    const conditions = [eq(githubPrivacySettings.workspaceId, workspace.id)];
    if (repositoryId) {
      conditions.push(eq(githubPrivacySettings.repositoryId, repositoryId));
    }
    if (commitSha) {
      conditions.push(eq(githubPrivacySettings.commitSha, commitSha));
    }

    const existing = await db.query.githubPrivacySettings.findFirst({
      where: and(...conditions),
    });

    if (existing) {
      return NextResponse.json({
        message: "Exclusion already exists",
        exclusion: existing,
      });
    }

    // Create new privacy exclusion
    const [exclusion] = await db
      .insert(githubPrivacySettings)
      .values({
        workspaceId: workspace.id,
        repositoryId: repositoryId ?? null,
        commitSha: commitSha ?? null,
        excludeFromContent: true,
      })
      .returning();

    return NextResponse.json(
      {
        message: "Exclusion added successfully",
        exclusion: {
          id: exclusion.id,
          repositoryId: exclusion.repositoryId,
          commitSha: exclusion.commitSha,
          excludeFromContent: exclusion.excludeFromContent,
          createdAt: exclusion.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/integrations/github/privacy] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to add privacy exclusion",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/integrations/github/privacy
 *
 * Removes a privacy exclusion
 *
 * Query params:
 * - workspace: string
 * - exclusionId: string (the ID of the privacy setting to remove)
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const workspaceSlug = searchParams.get("workspace");
    const exclusionId = searchParams.get("exclusionId");

    if (!workspaceSlug || !exclusionId) {
      return NextResponse.json(
        { error: "Workspace slug and exclusionId are required" },
        { status: 400 }
      );
    }

    // Verify workspace ownership
    const workspace = await db.query.workspaces.findFirst({
      where: and(
        eq(workspaces.slug, workspaceSlug),
        eq(workspaces.ownerId, session.user.id)
      ),
    });

    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace not found or access denied" },
        { status: 404 }
      );
    }

    // Delete the exclusion
    const deleted = await db
      .delete(githubPrivacySettings)
      .where(
        and(
          eq(githubPrivacySettings.id, exclusionId),
          eq(githubPrivacySettings.workspaceId, workspace.id)
        )
      )
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json(
        { error: "Exclusion not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Exclusion removed successfully",
    });
  } catch (error) {
    console.error("[DELETE /api/integrations/github/privacy] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to remove privacy exclusion",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
