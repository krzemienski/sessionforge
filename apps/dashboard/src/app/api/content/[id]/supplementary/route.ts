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

delete process.env.CLAUDECODE;

export const dynamic = "force-dynamic";

// ── Validation ──────────────────────────────────────────────────────────────

const VALID_TYPES = [
  "twitter_thread",
  "linkedin_post",
  "newsletter_excerpt",
  "executive_summary",
  "pull_quotes",
  "slide_outline",
  "evidence_highlights",
] as const;

type SupplementaryType = (typeof VALID_TYPES)[number];

const generateSchema = z.object({
  types: z.array(z.string()).min(1, "at least one type is required"),
});

// ── Prompts ─────────────────────────────────────────────────────────────────

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

function isValidType(value: string): value is SupplementaryType {
  return (VALID_TYPES as readonly string[]).includes(value);
}

function resolveTypes(requested: string[]): SupplementaryType[] {
  if (requested.includes("all")) {
    return [...VALID_TYPES];
  }
  const resolved = requested.filter(isValidType);
  if (resolved.length === 0) {
    throw new AppError(
      "No valid supplementary types provided",
      ERROR_CODES.VALIDATION_ERROR,
      400
    );
  }
  return resolved;
}

async function verifyPostOwnership(
  postId: string,
  userId: string
): Promise<{ post: NonNullable<Awaited<ReturnType<typeof db.query.posts.findFirst>>> }> {
  const post = await db.query.posts.findFirst({
    where: eq(posts.id, postId),
    with: { workspace: true },
  });

  if (!post) {
    throw new AppError("Post not found", ERROR_CODES.NOT_FOUND);
  }

  if (post.workspace.ownerId !== userId) {
    throw new AppError("Forbidden", ERROR_CODES.FORBIDDEN);
  }

  return { post };
}

async function generateContent(
  markdown: string,
  contentType: SupplementaryType
): Promise<string> {
  const model = getHaikuModel();
  const prompt = `${PROMPTS[contentType]}\n\n---\n\n${markdown}`;

  let responseText: string | null = null;
  for await (const message of query({
    prompt,
    options: { model, maxTurns: 1 },
  })) {
    if ("result" in message) {
      responseText = message.result;
    }
  }

  return responseText ?? "";
}

// ── GET ─────────────────────────────────────────────────────────────────────

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { post } = await verifyPostOwnership(id, session.user.id);

    const items = await db.query.supplementaryContent.findMany({
      where: and(
        eq(supplementaryContent.postId, id),
        eq(supplementaryContent.workspaceId, post.workspaceId)
      ),
    });

    return NextResponse.json({ items });
  })(request);
}

// ── POST ────────────────────────────────────────────────────────────────────

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { post } = await verifyPostOwnership(id, session.user.id);

    const rawBody = await request.json().catch(() => ({}));
    const { types: requestedTypes } = parseBody(generateSchema, rawBody);
    const types = resolveTypes(requestedTypes);

    const postMarkdown = post.markdown ?? "";
    if (!postMarkdown.trim()) {
      throw new AppError(
        "Post has no content to generate from",
        ERROR_CODES.BAD_REQUEST
      );
    }

    // Generate all types in parallel
    const results = await Promise.allSettled(
      types.map(async (contentType) => {
        const content = await generateContent(postMarkdown, contentType);
        return {
          contentType,
          content,
          metadata: {
            charCount: content.length,
            platform: contentType,
            format: "generated" as const,
          },
        };
      })
    );

    // Collect successful generations
    const toInsert: Array<{
      contentType: SupplementaryType;
      content: string;
      metadata: { charCount: number; platform: string; format: string };
    }> = [];
    for (const r of results) {
      if (r.status === "fulfilled") {
        toInsert.push(r.value);
      }
    }

    if (toInsert.length === 0) {
      throw new AppError(
        "All generation attempts failed",
        ERROR_CODES.INTERNAL_ERROR
      );
    }

    // Insert all rows
    const inserted = await db
      .insert(supplementaryContent)
      .values(
        toInsert.map((item) => ({
          postId: id,
          workspaceId: post.workspaceId,
          contentType: item.contentType,
          content: item.content,
          metadata: item.metadata,
        }))
      )
      .returning();

    return NextResponse.json({ items: inserted });
  })(request);
}
