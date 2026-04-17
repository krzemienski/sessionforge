import { ensureCliAuth } from "@/lib/ai/ensure-cli-auth";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts, supplementaryContent } from "@sessionforge/db";
import { eq, and } from "drizzle-orm/sql";
import { withApiHandler } from "@/lib/api-handler";
import { parseBody } from "@/lib/validation";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { z } from "zod";
import { getHaikuModel } from "@/lib/ai/orchestration/model-selector";
import { getAuthorizedWorkspaceById } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";


ensureCliAuth();

export const dynamic = "force-dynamic";

// ── Validation ──────────────────────────────────────────────────────────────

const updateSchema = z.object({
  content: z.string().min(1, "content is required"),
});

// ── Prompts (same as parent route) ──────────────────────────────────────────

type SupplementaryType =
  | "twitter_thread"
  | "linkedin_post"
  | "newsletter_excerpt"
  | "executive_summary"
  | "pull_quotes"
  | "slide_outline"
  | "evidence_highlights";

const PROMPTS: Record<SupplementaryType, string> = {
  twitter_thread:
    "Convert this blog post into a Twitter/X thread (5-10 tweets). Each tweet under 280 chars. Use numbered format (1/N). Include key insights and a hook.",
  linkedin_post:
    "Convert this blog post into a LinkedIn post (1000-1300 chars). Professional tone, include key takeaway, end with a question for engagement.",
  newsletter_excerpt:
    "Create a newsletter excerpt (200-400 words) summarizing this blog post. Include a teaser that makes readers want to read the full post.",
  executive_summary:
    "Write a 3-5 bullet executive summary of this blog post. Each bullet should capture a distinct key finding or recommendation.",
  pull_quotes:
    "Extract 3-5 of the most quotable, shareable sentences from this blog post. Each should be impactful standalone.",
  slide_outline:
    "Create a presentation slide outline (8-12 slides) from this blog post. Format: ## Slide N: Title\n- Bullet 1\n- Bullet 2\n- Bullet 3",
  evidence_highlights:
    "Extract the most compelling evidence-backed insights from this blog post. Focus on real data, discoveries, and verified findings. Format as a curated list.",
};

// ── Helpers ─────────────────────────────────────────────────────────────────

async function verifySupplementaryAccess(
  postId: string,
  suppId: string,
  session: Parameters<typeof getAuthorizedWorkspaceById>[0],
  permission: Parameters<typeof getAuthorizedWorkspaceById>[2]
) {
  const post = await db.query.posts.findFirst({
    where: eq(posts.id, postId),
    with: { workspace: true },
  });

  if (!post) {
    throw new AppError("Post not found", ERROR_CODES.NOT_FOUND);
  }

  await getAuthorizedWorkspaceById(session, post.workspaceId, permission);

  const item = await db.query.supplementaryContent.findFirst({
    where: and(
      eq(supplementaryContent.id, suppId),
      eq(supplementaryContent.postId, postId)
    ),
  });

  if (!item) {
    throw new AppError("Supplementary content not found", ERROR_CODES.NOT_FOUND);
  }

  return { post, item };
}

// ── PUT — manual edit ───────────────────────────────────────────────────────

export async function PUT(
  request: Request,
  ctx: { params: Promise<{ id: string; suppId: string }> }
) {
  const { id, suppId } = await ctx.params;
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    await verifySupplementaryAccess(id, suppId, session, PERMISSIONS.CONTENT_EDIT);

    const rawBody = await request.json().catch(() => ({}));
    const { content } = parseBody(updateSchema, rawBody);

    const [updated] = await db
      .update(supplementaryContent)
      .set({
        content,
        metadata: {
          charCount: content.length,
          format: "edited",
        },
        updatedAt: new Date(),
      })
      .where(eq(supplementaryContent.id, suppId))
      .returning();

    return NextResponse.json(updated);
  })(request);
}

// ── POST — regenerate single item ───────────────────────────────────────────

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string; suppId: string }> }
) {
  const { id, suppId } = await ctx.params;
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { post, item } = await verifySupplementaryAccess(
      id,
      suppId,
      session,
      PERMISSIONS.CONTENT_EDIT
    );

    const postMarkdown = post.markdown ?? "";
    if (!postMarkdown.trim()) {
      throw new AppError(
        "Post has no content to generate from",
        ERROR_CODES.BAD_REQUEST
      );
    }

    const contentType = item.contentType as SupplementaryType;
    const prompt = PROMPTS[contentType];

    if (!prompt) {
      throw new AppError(
        `Unknown supplementary type: ${contentType}`,
        ERROR_CODES.BAD_REQUEST
      );
    }

    const model = getHaikuModel();
    const queryPrompt = `${prompt}\n\n---\n\n${postMarkdown}`;

    let content = "";
    for await (const message of query({
      prompt: queryPrompt,
      options: { model, maxTurns: 1 },
    })) {
      if ("result" in message) {
        content = message.result ?? "";
      }
    }

    const [updated] = await db
      .update(supplementaryContent)
      .set({
        content,
        metadata: {
          charCount: content.length,
          platform: contentType,
          format: "generated",
        },
        updatedAt: new Date(),
      })
      .where(eq(supplementaryContent.id, suppId))
      .returning();

    return NextResponse.json(updated);
  })(request);
}
