import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { workspaces } from "@sessionforge/db";
import { eq } from "drizzle-orm";
import { streamBlogWriter } from "@/lib/ai/agents/blog-writer";
import { withApiHandler } from "@/lib/api-handler";
import { parseBody, agentBlogSchema } from "@/lib/validation";
import { AppError, ERROR_CODES } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const rawBody = await req.json().catch(() => ({}));
    const { workspaceSlug, insightId, tone, customInstructions } = parseBody(agentBlogSchema, rawBody);

    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.slug, workspaceSlug),
    });

    if (!workspace || workspace.ownerId !== session.user.id) {
      throw new AppError("Workspace not found", ERROR_CODES.NOT_FOUND);
    }

    return streamBlogWriter({
      workspaceId: workspace.id,
      insightId,
      tone: (tone ?? "technical") as Parameters<typeof streamBlogWriter>[0]["tone"],
      customInstructions,
    });
  })(req);
}
