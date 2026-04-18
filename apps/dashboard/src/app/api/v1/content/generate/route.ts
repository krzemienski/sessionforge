/**
 * Public API route for content generation via the Agent SDK.
 * Authenticates via API key, runs an agent to generate content,
 * then fires webhook events on completion.
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { posts } from "@sessionforge/db";
import { desc, eq } from "drizzle-orm/sql";
import { requireApiKey, apiResponse, withV1ApiHandler } from "@/lib/api-auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { BLOG_TECHNICAL_PROMPT } from "@/lib/ai/prompts/blog/technical";
import { BLOG_TUTORIAL_PROMPT } from "@/lib/ai/prompts/blog/tutorial";
import { BLOG_CONVERSATIONAL_PROMPT } from "@/lib/ai/prompts/blog/conversational";
import { TWITTER_THREAD_PROMPT } from "@/lib/ai/prompts/social/twitter-thread";
import { LINKEDIN_PROMPT } from "@/lib/ai/prompts/social/linkedin-post";
import { CHANGELOG_PROMPT } from "@/lib/ai/prompts/changelog";
import { createAgentMcpServer } from "@/lib/ai/mcp-server-factory";
import { runAgent } from "@/lib/ai/agent-runner";
import { fireWebhookEvent } from "@/lib/webhooks/events";
import type { AgentType } from "@/lib/ai/orchestration/tool-registry";

export const dynamic = "force-dynamic";

const BLOG_TONE_PROMPTS: Record<string, string> = {
  technical: BLOG_TECHNICAL_PROMPT,
  tutorial: BLOG_TUTORIAL_PROMPT,
  conversational: BLOG_CONVERSATIONAL_PROMPT,
};

const CONTENT_TYPE_CONFIG: Record<
  string,
  { agentType: AgentType; getSystemPrompt: (tone?: string) => string }
> = {
  blog_post: {
    agentType: "blog-writer",
    getSystemPrompt: (tone) => BLOG_TONE_PROMPTS[tone ?? "technical"] ?? BLOG_TECHNICAL_PROMPT,
  },
  twitter_thread: {
    agentType: "social-writer",
    getSystemPrompt: () => TWITTER_THREAD_PROMPT,
  },
  linkedin_post: {
    agentType: "social-writer",
    getSystemPrompt: () => LINKEDIN_PROMPT,
  },
  changelog: {
    agentType: "changelog-writer",
    getSystemPrompt: () => CHANGELOG_PROMPT,
  },
};

export const POST = withV1ApiHandler(async (req) => {
  const auth = await requireApiKey(req as NextRequest);

  let body: { insightId?: string; contentType?: string; tone?: string };
  try {
    body = await req.json();
  } catch {
    throw new AppError("Invalid JSON body", ERROR_CODES.BAD_REQUEST);
  }

  const { insightId, contentType, tone } = body;

  if (!insightId || !contentType) {
    throw new AppError(
      "insightId and contentType are required",
      ERROR_CODES.VALIDATION_ERROR,
    );
  }

  const config = CONTENT_TYPE_CONFIG[contentType];
  if (!config) {
    throw new AppError(
      `Invalid contentType. Must be one of: ${Object.keys(CONTENT_TYPE_CONFIG).join(", ")}`,
      ERROR_CODES.VALIDATION_ERROR,
    );
  }

  const wsId = auth.workspace.id;
  const systemPrompt = config.getSystemPrompt(tone);

  const userMessage = `Write a ${contentType.replace("_", " ")} about insight "${insightId}". First fetch the insight details and related session data. Then create the post using create_post.`;

  const mcpServer = createAgentMcpServer(config.agentType, wsId);

  try {
    await runAgent({
      agentType: config.agentType,
      workspaceId: wsId,
      systemPrompt,
      userMessage,
      mcpServer,
      trackRun: false,
    });
  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : "Content generation failed",
      ERROR_CODES.INTERNAL_ERROR,
    );
  }

  let createdPost: { id: string; title: string; contentType: string } | null = null;
  try {
    const [latest] = await db
      .select({
        id: posts.id,
        title: posts.title,
        contentType: posts.contentType,
      })
      .from(posts)
      .where(eq(posts.workspaceId, wsId))
      .orderBy(desc(posts.createdAt))
      .limit(1);

    if (latest) {
      createdPost = latest;
    }
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        timestamp: new Date().toISOString(),
        source: "v1.content.generate.post-lookup",
        workspaceId: wsId,
        agentType: config.agentType,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    throw new AppError(
      "Post lookup failed after content generation",
      ERROR_CODES.INTERNAL_ERROR,
    );
  }

  if (!createdPost) {
    throw new AppError(
      "Content generation completed but no post was created",
      ERROR_CODES.INTERNAL_ERROR,
    );
  }

  void fireWebhookEvent(wsId, "content.generated", {
    postId: createdPost.id,
    title: createdPost.title,
    contentType: createdPost.contentType,
  });

  return apiResponse(
    {
      postId: createdPost.id,
      title: createdPost.title,
      contentType: createdPost.contentType,
    },
    {},
  );
});
