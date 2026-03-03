import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { workspaces } from "@sessionforge/db";
import { eq } from "drizzle-orm";
import { streamNewsletterWriter } from "@/lib/ai/agents/newsletter-writer";
import { withApiHandler } from "@/lib/api-handler";
import { parseBody, agentNewsletterSchema } from "@/lib/validation";
import { AppError, ERROR_CODES } from "@/lib/errors";

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

    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.slug, workspaceSlug),
    });

    if (!workspace || workspace.ownerId !== session.user.id) {
      throw new AppError("Workspace not found", ERROR_CODES.NOT_FOUND);
    }

    return streamNewsletterWriter({
      workspaceId: workspace.id,
      lookbackDays,
      customInstructions,
    });
  })(request);
}
