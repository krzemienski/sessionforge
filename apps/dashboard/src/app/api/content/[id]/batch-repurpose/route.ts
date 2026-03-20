import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { posts } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { checkQuota, recordUsage } from "@/lib/billing/usage";
import { runAgent } from "@/lib/ai/agent-runner";
import { createAgentMcpServer } from "@/lib/ai/mcp-server-factory";
import { TWITTER_THREAD_PROMPT } from "@/lib/ai/prompts/social/twitter-thread";
import { LINKEDIN_PROMPT } from "@/lib/ai/prompts/social/linkedin-post";
import { CHANGELOG_FROM_POST_PROMPT } from "@/lib/ai/prompts/repurpose/changelog-from-post";
import { TLDR_PROMPT } from "@/lib/ai/prompts/repurpose/tldr";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const VALID_TARGET_FORMATS = [
  "twitter_thread",
  "linkedin_post",
  "changelog",
  "tldr",
] as const;

type TargetFormat = (typeof VALID_TARGET_FORMATS)[number];

const PROMPTS: Record<TargetFormat, string> = {
  twitter_thread: TWITTER_THREAD_PROMPT,
  linkedin_post: LINKEDIN_PROMPT,
  changelog: CHANGELOG_FROM_POST_PROMPT,
  tldr: TLDR_PROMPT,
};

const CONTENT_TYPES: Record<
  TargetFormat,
  "twitter_thread" | "linkedin_post" | "changelog" | "custom"
> = {
  twitter_thread: "twitter_thread",
  linkedin_post: "linkedin_post",
  changelog: "changelog",
  tldr: "custom",
};

const FORMAT_LABELS: Record<TargetFormat, string> = {
  twitter_thread: "Twitter thread",
  linkedin_post: "LinkedIn post",
  changelog: "changelog entry",
  tldr: "TL;DR summary",
};

interface BatchRepurposeResult {
  format: TargetFormat;
  success: boolean;
  postId?: string;
  error?: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { id: postId } = await params;
    const body = await request.json();
    const { workspaceSlug, targetFormats, customInstructions } = body;

    if (!workspaceSlug || !targetFormats) {
      throw new AppError(
        "workspaceSlug and targetFormats are required",
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    if (!Array.isArray(targetFormats) || targetFormats.length === 0) {
      throw new AppError(
        "targetFormats must be a non-empty array",
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Validate each format
    for (const format of targetFormats) {
      if (!VALID_TARGET_FORMATS.includes(format as TargetFormat)) {
        throw new AppError(
          `Invalid format: ${format}. Must be one of: twitter_thread, linkedin_post, changelog, tldr`,
          ERROR_CODES.VALIDATION_ERROR
        );
      }
    }

    const { workspace } = await getAuthorizedWorkspace(
      session,
      workspaceSlug,
      PERMISSIONS.CONTENT_CREATE
    );

    const sourcePost = await db.query.posts.findFirst({
      where: eq(posts.id, postId),
    });

    if (!sourcePost || sourcePost.workspaceId !== workspace.id) {
      throw new AppError("Source post not found", ERROR_CODES.NOT_FOUND);
    }

    // Check quota for batch operation
    const quota = await checkQuota(session.user.id, "content_generation");
    if (!quota.allowed) {
      return new Response(JSON.stringify({
        error: "Monthly content generation quota exceeded",
        quota: { limit: quota.limit, remaining: quota.remaining, percentUsed: quota.percentUsed },
      }), { status: 402, headers: { "Content-Type": "application/json" } });
    }

    // Process each format
    const results: BatchRepurposeResult[] = [];
    const mcpServer = createAgentMcpServer("repurpose-writer", workspace.id);

    for (const targetFormat of targetFormats as TargetFormat[]) {
      try {
        const systemPrompt = PROMPTS[targetFormat];
        const formatLabel = FORMAT_LABELS[targetFormat];
        const contentType = CONTENT_TYPES[targetFormat];

        const baseInstruction = `Create a ${formatLabel} from the blog post with ID "${postId}". First fetch the post content using get_post. Then create the derived post using create_post with content_type "${contentType}", parentPostId set to "${postId}", and sourceMetadata including parentPostId: "${postId}" and generatedBy: "repurpose_writer".`;
        const userMessage = customInstructions
          ? `${baseInstruction}\n\nAdditional instructions: ${customInstructions}`
          : baseInstruction;

        await runAgent({
          agentType: "repurpose-writer",
          workspaceId: workspace.id,
          systemPrompt,
          userMessage,
          mcpServer,
          trackRun: false,
        });

        // Get the created post (most recent post with this parent)
        const createdPost = await db.query.posts.findFirst({
          where: eq(posts.parentPostId, postId),
          orderBy: (posts, { desc }) => [desc(posts.createdAt)],
        });

        results.push({
          format: targetFormat,
          success: true,
          postId: createdPost?.id,
        });

        // Record usage for each successful generation
        void recordUsage(session.user.id, workspace.id, "content_generation", 0.03);
      } catch (error) {
        results.push({
          format: targetFormat,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
        sourcePostId: postId,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  })(request);
}
