import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { streamNewsletterWriter } from "@/lib/ai/agents/newsletter-writer";
import { withApiHandler } from "@/lib/api-handler";
import { parseBody, agentNewsletterSchema } from "@/lib/validation";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { checkQuota, recordUsage } from "@/lib/billing/usage";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const rawBody = await request.json().catch(() => ({}));
    const { workspaceSlug, lookbackDays, customInstructions } = parseBody(
      agentNewsletterSchema,
      rawBody
    );

    const { workspace } = await getAuthorizedWorkspace(
      session,
      workspaceSlug,
      PERMISSIONS.CONTENT_CREATE
    );

    const quota = await checkQuota(session.user.id, "content_generation");
    if (!quota.allowed) {
      return new Response(JSON.stringify({
        error: "Monthly content generation quota exceeded",
        quota: { limit: quota.limit, remaining: quota.remaining, percentUsed: quota.percentUsed },
      }), { status: 402, headers: { "Content-Type": "application/json" } });
    }

    const result = await streamNewsletterWriter({
      workspaceId: workspace.id,
      lookbackDays: lookbackDays ?? 7,
      customInstructions,
    });

    void recordUsage(session.user.id, workspace.id, "content_generation", 0.05);

    return result;
  })(request);
}
