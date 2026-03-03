import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces } from "@sessionforge/db";
import { eq } from "drizzle-orm";
import { extractInsight } from "@/lib/ai/agents/insight-extractor";
import { withApiHandler } from "@/lib/api-handler";
import { parseBody, insightExtractSchema } from "@/lib/validation";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { fireWebhookEvent } from "@/lib/webhooks/events";
import { checkQuota, recordUsage } from "@/lib/billing/usage";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const rawBody = await req.json().catch(() => ({}));
    const { sessionId, workspaceSlug } = parseBody(insightExtractSchema, rawBody);

    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.slug, workspaceSlug),
    });

    if (!workspace || workspace.ownerId !== session.user.id) {
      throw new AppError("Workspace not found", ERROR_CODES.NOT_FOUND);
    }

    const quota = await checkQuota(session.user.id, "insight_extraction");
    if (!quota.allowed) {
      return NextResponse.json(
        {
          error: "Monthly insight extraction quota exceeded",
          quota: { limit: quota.limit, remaining: quota.remaining, percentUsed: quota.percentUsed },
        },
        { status: 402 }
      );
    }

    const result = await extractInsight({
      workspaceId: workspace.id,
      sessionId,
    });

    const insight = result.insight;
    if (insight) {
      void fireWebhookEvent(workspace.id, "insight.extracted", {
        insightId: insight.id,
        title: insight.title,
        category: insight.category,
        compositeScore: insight.compositeScore,
      });
    }

    void recordUsage(session.user.id, workspace.id, "insight_extraction", 0.01);

    return NextResponse.json(result);
  })(req);
}
