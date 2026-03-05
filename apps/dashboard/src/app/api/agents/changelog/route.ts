import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { workspaces } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";
import { streamChangelogWriter } from "@/lib/ai/agents/changelog-writer";
import { withApiHandler } from "@/lib/api-handler";
import { parseBody, agentChangelogSchema } from "@/lib/validation";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { checkQuota, recordUsage } from "@/lib/billing/usage";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const rawBody = await req.json().catch(() => ({}));
    const { workspaceSlug, lookbackDays, projectFilter, customInstructions } = parseBody(agentChangelogSchema, rawBody);

    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.slug, workspaceSlug),
    });

    if (!workspace || workspace.ownerId !== session.user.id) {
      throw new AppError("Workspace not found", ERROR_CODES.NOT_FOUND);
    }

    const quota = await checkQuota(session.user.id, "content_generation");
    if (!quota.allowed) {
      return new Response(JSON.stringify({
        error: "Monthly content generation quota exceeded",
        quota: { limit: quota.limit, remaining: quota.remaining, percentUsed: quota.percentUsed },
      }), { status: 402, headers: { "Content-Type": "application/json" } });
    }

    const result = await streamChangelogWriter({
      workspaceId: workspace.id,
      lookbackDays,
      projectFilter,
      customInstructions,
    });

    void recordUsage(session.user.id, workspace.id, "content_generation", 0.05);

    return result;
  })(req);
}
