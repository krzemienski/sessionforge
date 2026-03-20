import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts } from "@sessionforge/db";
import type { RiskFlag } from "@sessionforge/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/content/[id]/risk-flags
 *
 * Returns stored risk flags for a post along with verification summary stats
 * (total flags, unresolved count, critical count, verification status).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const post = await db.query.posts.findFirst({
    where: eq(posts.id, id),
    columns: {
      id: true,
      riskFlags: true,
      verificationStatus: true,
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

  const flags = (post.riskFlags as RiskFlag[]) ?? [];

  const unresolvedCount = flags.filter((f) => f.status === "unresolved").length;
  const criticalCount = flags.filter((f) => f.severity === "critical").length;
  const highCount = flags.filter((f) => f.severity === "high").length;

  return NextResponse.json({
    postId: post.id,
    verificationStatus: post.verificationStatus ?? "unverified",
    flags,
    summary: {
      totalFlags: flags.length,
      unresolvedCount,
      criticalCount,
      highCount,
    },
  });
}
