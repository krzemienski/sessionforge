import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { authenticateApiKey, apiResponse, apiError } from "@/lib/api-auth";
import { getModelForAgent } from "@/lib/ai/orchestration/model-selector";
import { getToolsForAgent } from "@/lib/ai/orchestration/tool-registry";
import { handleSessionReaderTool } from "@/lib/ai/tools/session-reader";
import { handleInsightTool } from "@/lib/ai/tools/insight-tools";
import { handlePostManagerTool } from "@/lib/ai/tools/post-manager";
import { handleSkillLoaderTool } from "@/lib/ai/tools/skill-loader";
import { BLOG_TECHNICAL_PROMPT } from "@/lib/ai/prompts/blog/technical";
import { BLOG_TUTORIAL_PROMPT } from "@/lib/ai/prompts/blog/tutorial";
import { BLOG_CONVERSATIONAL_PROMPT } from "@/lib/ai/prompts/blog/conversational";
import { TWITTER_THREAD_PROMPT } from "@/lib/ai/prompts/social/twitter-thread";
import { LINKEDIN_PROMPT } from "@/lib/ai/prompts/social/linkedin-post";
import { CHANGELOG_PROMPT } from "@/lib/ai/prompts/changelog";
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

const client = new Anthropic();

async function dispatchTool(
  workspaceId: string,
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<unknown> {
  if (
    toolName.startsWith("get_session") ||
    toolName === "list_sessions_by_timeframe"
  ) {
    return handleSessionReaderTool(workspaceId, toolName, toolInput);
  }
  if (
    toolName.startsWith("get_insight") ||
    toolName === "get_top_insights" ||
    toolName === "create_insight"
  ) {
    return handleInsightTool(workspaceId, toolName, toolInput);
  }
  if (
    toolName === "create_post" ||
    toolName === "update_post" ||
    toolName === "get_post" ||
    toolName === "get_markdown"
  ) {
    return handlePostManagerTool(workspaceId, toolName, toolInput);
  }
  if (
    toolName === "list_available_skills" ||
    toolName === "get_skill_by_name"
  ) {
    return handleSkillLoaderTool(toolName, toolInput);
  }
  throw new Error(`Unknown tool: ${toolName}`);
}

export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth) return apiError("Unauthorized", 401);

  let body: { insightId?: string; contentType?: string; tone?: string };
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const { insightId, contentType, tone } = body;

  if (!insightId || !contentType) {
    return apiError("insightId and contentType are required", 400);
  }

  const config = CONTENT_TYPE_CONFIG[contentType];
  if (!config) {
    return apiError(
      `Invalid contentType. Must be one of: ${Object.keys(CONTENT_TYPE_CONFIG).join(", ")}`,
      400
    );
  }

  const wsId = auth.workspace.id;
  const model = getModelForAgent(config.agentType);
  const tools = getToolsForAgent(config.agentType);
  const systemPrompt = config.getSystemPrompt(tone);

  const userMessage = `Write a ${contentType.replace("_", " ")} about insight "${insightId}". First fetch the insight details and related session data. Then create the post using create_post.`;

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  let createdPost: { id: string; title: string; contentType: string } | null = null;

  try {
    let response = await client.messages.create({
      model,
      max_tokens: 8192,
      system: systemPrompt,
      tools: tools as Anthropic.Tool[],
      messages,
    });

    while (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ContentBlock & { type: "tool_use" } =>
          b.type === "tool_use"
      );

      const toolResults: Anthropic.MessageParam = {
        role: "user",
        content: await Promise.all(
          toolUseBlocks.map(async (toolUse) => {
            try {
              const result = await dispatchTool(
                wsId,
                toolUse.name,
                toolUse.input as Record<string, unknown>
              );

              if (toolUse.name === "create_post" && result && typeof result === "object") {
                const post = result as { id: string; title: string; contentType: string };
                if (!createdPost) createdPost = post;
              }

              return {
                type: "tool_result" as const,
                tool_use_id: toolUse.id,
                content: JSON.stringify(result),
              };
            } catch (error) {
              return {
                type: "tool_result" as const,
                tool_use_id: toolUse.id,
                content: `Error: ${error instanceof Error ? error.message : String(error)}`,
                is_error: true,
              };
            }
          })
        ),
      };

      messages.push({ role: "assistant", content: response.content });
      messages.push(toolResults);

      response = await client.messages.create({
        model,
        max_tokens: 8192,
        system: systemPrompt,
        tools: tools as Anthropic.Tool[],
        messages,
      });
    }
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Content generation failed",
      500
    );
  }

  if (!createdPost) {
    return apiError("Content generation completed but no post was created", 500);
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
    {}
  );
}
