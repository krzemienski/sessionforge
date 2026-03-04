/**
 * Background content generator for automated content pipelines.
 * Uses the Agent SDK with MCP tools to generate content from insights
 * and returns the created post ID.
 */

import { db } from "@/lib/db";
import { posts } from "@sessionforge/db";
import { desc, eq } from "drizzle-orm/sql";
import { BLOG_TECHNICAL_PROMPT } from "../ai/prompts/blog/technical";
import { TWITTER_THREAD_PROMPT } from "../ai/prompts/social/twitter-thread";
import { LINKEDIN_PROMPT } from "../ai/prompts/social/linkedin-post";
import { CHANGELOG_PROMPT } from "../ai/prompts/changelog";
import { createAgentMcpServer } from "../ai/mcp-server-factory";
import { runAgent } from "../ai/agent-runner";
import type { AgentType } from "../ai/orchestration/tool-registry";

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
  input: GenerateContentInput,
): Promise<{ postId: string } | null> {
  const config = CONTENT_CONFIG[input.contentType];

  const mcpServer = createAgentMcpServer(config.agentType, input.workspaceId);

  await runAgent(
    {
      agentType: config.agentType,
      workspaceId: input.workspaceId,
      systemPrompt: config.systemPrompt,
      userMessage: config.buildUserMessage(input),
      mcpServer,
      trackRun: false,
    },
  );

  // Query the DB for the most recently created post by this workspace
  try {
    const [latest] = await db
      .select({ id: posts.id })
      .from(posts)
      .where(eq(posts.workspaceId, input.workspaceId))
      .orderBy(desc(posts.createdAt))
      .limit(1);

    if (latest) {
      return { postId: latest.id };
    }
  } catch {
    // DB query failure
  }

  return null;
}
