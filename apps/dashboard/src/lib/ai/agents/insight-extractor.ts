/**
 * Insight extractor agent for analyzing sessions and generating insights.
 * Uses the Agent SDK with MCP tools to read session data and create insights.
 */

import { db } from "@/lib/db";
import { insights } from "@sessionforge/db";
import { desc, eq, and } from "drizzle-orm/sql";
import { INSIGHT_EXTRACTION_PROMPT } from "../prompts/insight-extraction";
import { createAgentMcpServer } from "../mcp-server-factory";
import { runAgent } from "../agent-runner";

/** Input parameters for the insight extraction agent. */
interface ExtractInsightInput {
  /** The workspace that owns the session. */
  workspaceId: string;
  /** The session to analyze and extract an insight from. */
  sessionId: string;
}

type CreatedInsight = {
  id: string;
  title: string;
  category: string;
  compositeScore: number;
};


export async function extractInsight(input: ExtractInsightInput): Promise<{
  result: string | null;
  insight: CreatedInsight | null;
}> {
  const mcpServer = createAgentMcpServer("insight-extractor", input.workspaceId);

  const { text } = await runAgent(
    {
      agentType: "insight-extractor",
      workspaceId: input.workspaceId,
      systemPrompt: INSIGHT_EXTRACTION_PROMPT,
      userMessage: `Analyze session "${input.sessionId}" and extract the most valuable insight. First use get_session_summary and get_session_messages to understand the session, then use create_insight to save it.`,
      mcpServer,
    },
    {
      sessionId: input.sessionId,
      workspaceId: input.workspaceId,
    },
  );

  // Query the DB for the most recently created insight for this session
  let createdInsight: CreatedInsight | null = null;
  try {
    const [latest] = await db
      .select({
        id: insights.id,
        title: insights.title,
        category: insights.category,
        compositeScore: insights.compositeScore,
      })
      .from(insights)
      .where(
        and(
          eq(insights.workspaceId, input.workspaceId),
          eq(insights.sessionId, input.sessionId),
        ),
      )
      .orderBy(desc(insights.createdAt))
      .limit(1);

    if (latest) {
      createdInsight = {
        id: latest.id,
        title: latest.title,
        category: latest.category,
        compositeScore: Number(latest.compositeScore),
      };
    }
  } catch {
    // DB query failure should not suppress the agent result
  }

  return { result: text, insight: createdInsight };
}
