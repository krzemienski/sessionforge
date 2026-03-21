import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { workspaces, posts } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";
import { streamRepurposeWriter } from "@/lib/ai/agents/repurpose-writer";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { checkQuota, recordUsage } from "@/lib/billing/usage";

export const dynamic = "force-dynamic";

const VALID_TARGET_FORMATS = [
  "twitter_thread",
  "linkedin_post",
  "changelog",
  "tldr",
  "blog_post",
  "newsletter",
  "doc_page",
] as const;

type TargetFormat = (typeof VALID_TARGET_FORMATS)[number];

export async function POST(request: Request) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const body = await request.json();
    const { workspaceSlug, sourcePostId, targetFormat, customInstructions } = body;

    if (!workspaceSlug || !sourcePostId || !targetFormat) {
      throw new AppError(
        "workspaceSlug, sourcePostId, and targetFormat are required",
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    if (!VALID_TARGET_FORMATS.includes(targetFormat as TargetFormat)) {
      throw new AppError(
        "targetFormat must be one of: twitter_thread, linkedin_post, changelog, tldr, blog_post, newsletter, doc_page",
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.slug, workspaceSlug),
    });

    if (!workspace || workspace.ownerId !== session.user.id) {
      throw new AppError("Workspace not found", ERROR_CODES.NOT_FOUND);
    }

    const sourcePost = await db.query.posts.findFirst({
      where: eq(posts.id, sourcePostId),
    });

    if (!sourcePost || sourcePost.workspaceId !== workspace.id) {
      throw new AppError("Source post not found", ERROR_CODES.NOT_FOUND);
    }

    const quota = await checkQuota(session.user.id, "content_generation");
    if (!quota.allowed) {
      return new Response(JSON.stringify({
        error: "Monthly content generation quota exceeded",
        quota: { limit: quota.limit, remaining: quota.remaining, percentUsed: quota.percentUsed },
      }), { status: 402, headers: { "Content-Type": "application/json" } });
    }

    const result = await streamRepurposeWriter({
      workspaceId: workspace.id,
      sourcePostId,
      targetFormat: targetFormat as TargetFormat,
      customInstructions,
    });

    void recordUsage(session.user.id, workspace.id, "content_generation", 0.03);

    return result;
  })(request);
}
