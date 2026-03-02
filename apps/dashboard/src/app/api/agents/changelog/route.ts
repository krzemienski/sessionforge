import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces } from "@sessionforge/db";
import { eq } from "drizzle-orm";
import { streamChangelogWriter } from "@/lib/ai/agents/changelog-writer";
import { checkQuota, recordUsage } from "@/lib/billing/usage";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { workspaceSlug, lookbackDays, projectFilter, customInstructions } = body;

  if (!workspaceSlug || !lookbackDays) {
    return NextResponse.json(
      { error: "workspaceSlug and lookbackDays are required" },
      { status: 400 }
    );
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, workspaceSlug),
  });

  if (!workspace || workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const quota = await checkQuota(session.user.id, "content_generation");
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: "Monthly content generation quota exceeded",
        quota: {
          limit: quota.limit,
          remaining: quota.remaining,
          percentUsed: quota.percentUsed,
        },
      },
      { status: 402 }
    );
  }

  const estimatedCost = 0.05;
  await recordUsage(
    session.user.id,
    workspace.id,
    "content_generation",
    estimatedCost
  );

  return streamChangelogWriter({
    workspaceId: workspace.id,
    lookbackDays: Number(lookbackDays),
    projectFilter,
    customInstructions,
  });
}
