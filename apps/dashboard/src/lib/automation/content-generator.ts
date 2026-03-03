import Anthropic from "@anthropic-ai/sdk";
import { getModelForAgent } from "../ai/orchestration/model-selector";
import { getToolsForAgent } from "../ai/orchestration/tool-registry";
import { handleSessionReaderTool } from "../ai/tools/session-reader";
import { handleInsightTool } from "../ai/tools/insight-tools";
import { handlePostManagerTool } from "../ai/tools/post-manager";
import { BLOG_TECHNICAL_PROMPT } from "../ai/prompts/blog/technical";
import { TWITTER_THREAD_PROMPT } from "../ai/prompts/social/twitter-thread";
import { LINKEDIN_PROMPT } from "../ai/prompts/social/linkedin-post";
import { CHANGELOG_PROMPT } from "../ai/prompts/changelog";
import type { AgentType } from "../ai/orchestration/tool-registry";

const client = new Anthropic();

type ContentType = "blog_post" | "twitter_thread" | "linkedin_post" | "changelog";

interface GenerateContentInput {
  workspaceId: string;
  contentType: ContentType;
  insightIds?: string[];
  lookbackDays?: number;
}

interface ContentConfig {
  agentType: AgentType;
  systemPrompt: string;
  buildUserMessage: (input: GenerateContentInput) => string;
}

const CONTENT_CONFIG: Record<ContentType, ContentConfig> = {
  blog_post: {
    agentType: "blog-writer",
    systemPrompt: BLOG_TECHNICAL_PROMPT,
    buildUserMessage: (input) => {
      const ids = input.insightIds?.join('", "') ?? "";
      return `Write a blog post based on the insights "${ids}". First fetch each insight's details and related session data. Then create the post using create_post.`;
    },
  },
  twitter_thread: {
    agentType: "social-writer",
    systemPrompt: TWITTER_THREAD_PROMPT,
    buildUserMessage: (input) => {
      const ids = input.insightIds?.join('", "') ?? "";
      return `Create a Twitter thread based on the insights "${ids}". First fetch each insight's details and related session data. Then save it with create_post using content_type "twitter_thread".`;
    },
  },
  linkedin_post: {
    agentType: "social-writer",
    systemPrompt: LINKEDIN_PROMPT,
    buildUserMessage: (input) => {
      const ids = input.insightIds?.join('", "') ?? "";
      return `Create a LinkedIn post based on the insights "${ids}". First fetch each insight's details and related session data. Then save it with create_post using content_type "linkedin_post".`;
    },
  },
  changelog: {
    agentType: "changelog-writer",
    systemPrompt: CHANGELOG_PROMPT,
    buildUserMessage: (input) => {
      const days = input.lookbackDays ?? 7;
      return `Generate a changelog for the last ${days} days. First use list_sessions_by_timeframe, then get_session_summary for notable sessions, then create a changelog post with create_post.`;
    },
  },
};

export async function generateContent(
  input: GenerateContentInput
): Promise<{ postId: string } | null> {
  const config = CONTENT_CONFIG[input.contentType];
  const model = getModelForAgent(config.agentType);
  const tools = getToolsForAgent(config.agentType);

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: config.buildUserMessage(input),
    },
  ];

  let response = await client.messages.create({
    model,
    max_tokens: 8192,
    system: config.systemPrompt,
    tools: tools as Anthropic.Tool[],
    messages,
  });

  let capturedPostId: string | null = null;

  // Tool dispatch loop
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
              input.workspaceId,
              toolUse.name,
              toolUse.input as Record<string, unknown>
            );

            // Capture the postId when create_post succeeds
            if (toolUse.name === "create_post" && result && typeof result === "object") {
              const post = result as { id?: string };
              if (post.id) {
                capturedPostId = post.id;
              }
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
      system: config.systemPrompt,
      tools: tools as Anthropic.Tool[],
      messages,
    });
  }

  if (!capturedPostId) {
    return null;
  }

  return { postId: capturedPostId };
}

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
  throw new Error(`Unknown tool: ${toolName}`);
}
