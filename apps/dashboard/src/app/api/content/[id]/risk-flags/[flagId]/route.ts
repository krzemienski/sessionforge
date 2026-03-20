import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts, riskFlagResolutions } from "@sessionforge/db";
import type { RiskFlag } from "@sessionforge/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/content/[id]/risk-flags/[flagId]
 *
 * Updates a specific risk flag's status (verified/dismissed/overridden)
 * with the resolving user's ID and optional evidence notes.
 * Also creates a resolution record in the riskFlagResolutions table.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; flagId: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, flagId } = await params;

  const post = await db.query.posts.findFirst({
    where: eq(posts.id, id),
    columns: {
      id: true,
      riskFlags: true,
      workspaceId: true,
    },
    with: {
      workspace: true,
    },
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (post.workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { status, evidenceNotes } = body as {
    status: "verified" | "dismissed" | "overridden";
    evidenceNotes?: string;
  };

  const validStatuses = ["verified", "dismissed", "overridden"];
  if (!status || !validStatuses.includes(status)) {
    return NextResponse.json(
      { error: "Invalid status. Must be one of: verified, dismissed, overridden" },
      { status: 400 }
    );
  }

  const flags = ((post.riskFlags as RiskFlag[]) ?? []).slice();
  const flagIndex = flags.findIndex((f) => f.id === flagId);

  if (flagIndex === -1) {
    return NextResponse.json({ error: "Risk flag not found" }, { status: 404 });
  }

  const now = new Date().toISOString();

  // Update the flag in the JSONB array
  flags[flagIndex] = {
    ...flags[flagIndex],
    status,
    resolvedBy: session.user.id,
    resolvedAt: now,
  };

  // Recompute verification status
  const unresolvedCount = flags.filter((f) => f.status === "unresolved").length;
  const verificationStatus = unresolvedCount === 0 ? "verified" : "has_issues";

  try {
    // Persist updated flags and status
    await db
      .update(posts)
      .set({
        riskFlags: flags,
        verificationStatus,
      })
      .where(eq(posts.id, id));

    // Create a resolution record
    await db.insert(riskFlagResolutions).values({
      postId: id,
      flagId,
      status,
      resolvedBy: session.user.id,
      evidenceNotes: evidenceNotes ?? null,
    });

    return NextResponse.json({
      flagId,
      status,
      resolvedBy: session.user.id,
      resolvedAt: now,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 500 }
    );
  }
}
