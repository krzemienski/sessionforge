import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { workspaces, insights } from "@sessionforge/db";
import { eq, desc, and } from "drizzle-orm";
import { getModelForAgent } from "@/lib/ai/orchestration/model-selector";
import { getToolsForAgent } from "@/lib/ai/orchestration/tool-registry";
import { handleSessionReaderTool } from "@/lib/ai/tools/session-reader";
import { handleInsightTool } from "@/lib/ai/tools/insight-tools";
import { handlePostManagerTool } from "@/lib/ai/tools/post-manager";
import { handleSkillLoaderTool } from "@/lib/ai/tools/skill-loader";
import { scanSessionFiles } from "@/lib/sessions/scanner";
import { parseSessionFile } from "@/lib/sessions/parser";
import { normalizeSession } from "@/lib/sessions/normalizer";
import { indexSessions } from "@/lib/sessions/indexer";
import { BLOG_TECHNICAL_PROMPT } from "@/lib/ai/prompts/blog/technical";
import { BLOG_TUTORIAL_PROMPT } from "@/lib/ai/prompts/blog/tutorial";
import { BLOG_CONVERSATIONAL_PROMPT } from "@/lib/ai/prompts/blog/conversational";
import { TWITTER_THREAD_PROMPT } from "@/lib/ai/prompts/social/twitter-thread";
import { LINKEDIN_PROMPT } from "@/lib/ai/prompts/social/linkedin-post";
import { CHANGELOG_PROMPT } from "@/lib/ai/prompts/changelog";
import { fireWebhookEvent } from "@/lib/webhooks/events";
import type { contentTypeEnum, lookbackWindowEnum } from "@sessionforge/db";

const client = new Anthropic();

type ContentType = (typeof contentTypeEnum.enumValues)[number];
type LookbackWindow = (typeof lookbackWindowEnum.enumValues)[number];

export interface PipelineInput {
  workspaceId: string;
  contentType: ContentType;
  lookbackWindow: LookbackWindow;
  triggerId: string;
}

export interface PipelineResult {
  postsGenerated: number;
  sessionsScanned: number;
  errors: string[];
}

const LOOKBACK_DAYS: Record<LookbackWindow, number> = {
  current_day: 1,
  yesterday: 1,
  last_7_days: 7,
  last_14_days: 14,
  last_30_days: 30,
  custom: 7,
};

type PipelineAgentType = "blog-writer" | "social-writer" | "changelog-writer";

async function runAgentLoop(
  workspaceId: string,
  systemPrompt: string,
  userMessage: string,
  agentType: PipelineAgentType
): Promise<number> {
  const model = getModelForAgent(agentType);
  const tools = getToolsForAgent(agentType);

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  let response = await client.messages.create({
    model,
    max_tokens: 8192,
    system: systemPrompt,
    tools: tools as Anthropic.Tool[],
    messages,
  });

  let postsCreated = 0;

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
              workspaceId,
              agentType,
              toolUse.name,
              toolUse.input as Record<string, unknown>
            );
            if (toolUse.name === "create_post") postsCreated++;
            return {
              type: "tool_result" as const,
              tool_use_id: toolUse.id,
              content: JSON.stringify(result),
            };
          } catch (error) {
            const errMsg =
              error instanceof Error ? error.message : String(error);
            return {
              type: "tool_result" as const,
              tool_use_id: toolUse.id,
              content: `Error: ${errMsg}`,
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

  return postsCreated;
}

async function dispatchTool(
  workspaceId: string,
  agentType: PipelineAgentType,
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

export async function runAutomationPipeline(
  input: PipelineInput
): Promise<PipelineResult> {
  const errors: string[] = [];
  let postsGenerated = 0;
  let sessionsScanned = 0;

  const lookbackDays = LOOKBACK_DAYS[input.lookbackWindow] ?? 7;

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, input.workspaceId),
  });

  if (!workspace) {
    throw new Error(`Workspace ${input.workspaceId} not found`);
  }

  const basePath = workspace.sessionBasePath ?? "~/.claude";

  try {
    const files = await scanSessionFiles(lookbackDays, basePath);
    const normalized = await Promise.all(
      files.map(async (meta) => {
        const parsed = await parseSessionFile(meta.filePath);
        return normalizeSession(meta, parsed);
      })
    );
    const result = await indexSessions(input.workspaceId, normalized);
    sessionsScanned = result.scanned;
  } catch (error) {
    errors.push(
      `Session scan failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const { contentType, workspaceId } = input;

  if (contentType === "changelog") {
    const userMessage = `Generate a changelog for the last ${lookbackDays} days. First use list_sessions_by_timeframe with lookbackDays=${lookbackDays}, then get_session_summary for notable sessions, then create a changelog post with create_post.`;
    try {
      const count = await runAgentLoop(
        workspaceId,
        CHANGELOG_PROMPT,
        userMessage,
        "changelog-writer"
      );
      postsGenerated += count;
    } catch (error) {
      errors.push(
        `Changelog generation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  } else {
    let topInsights: { id: string }[] = [];
    try {
      topInsights = await db.query.insights.findMany({
        where: and(
          eq(insights.workspaceId, workspaceId),
          eq(insights.usedInContent, false)
        ),
        orderBy: [desc(insights.compositeScore)],
        limit: 2,
        columns: { id: true },
      });
    } catch (error) {
      errors.push(
        `Insight fetch failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    if (topInsights.length === 0) {
      errors.push("No unused insights found for content generation");
    }

    for (const insight of topInsights) {
      try {
        let count = 0;

        if (contentType === "twitter_thread") {
          const userMessage = `Create a twitter post about insight "${insight.id}". First fetch insight details. Then create the post with content_type "twitter_thread".`;
          count = await runAgentLoop(
            workspaceId,
            TWITTER_THREAD_PROMPT,
            userMessage,
            "social-writer"
          );
        } else if (contentType === "linkedin_post") {
          const userMessage = `Create a linkedin post about insight "${insight.id}". First fetch insight details and session data. Then save it with create_post using content_type "linkedin_post".`;
          count = await runAgentLoop(
            workspaceId,
            LINKEDIN_PROMPT,
            userMessage,
            "social-writer"
          );
        } else if (contentType === "devto_post") {
          const userMessage = `Write a blog post for dev.to about insight "${insight.id}". First fetch the insight details and related session data. Then create the post using create_post.`;
          count = await runAgentLoop(
            workspaceId,
            BLOG_TUTORIAL_PROMPT,
            userMessage,
            "blog-writer"
          );
        } else if (contentType === "newsletter") {
          const userMessage = `Write a newsletter section about insight "${insight.id}". First fetch the insight details and related session data. Then create the post using create_post.`;
          count = await runAgentLoop(
            workspaceId,
            BLOG_CONVERSATIONAL_PROMPT,
            userMessage,
            "blog-writer"
          );
        } else {
          // blog_post or custom
          const userMessage = `Write a blog post about insight "${insight.id}". First fetch the insight details and related session data. Then create the post using create_post.`;
          count = await runAgentLoop(
            workspaceId,
            BLOG_TECHNICAL_PROMPT,
            userMessage,
            "blog-writer"
          );
        }

        postsGenerated += count;
      } catch (error) {
        errors.push(
          `Content generation for insight ${insight.id} failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  void fireWebhookEvent(input.workspaceId, "automation.completed", {
    postsGenerated,
    sessionsScanned,
    errors,
  });

  return { postsGenerated, sessionsScanned, errors };
}
