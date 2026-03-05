/**
 * Changelog writer agent that summarizes recent sessions into a changelog post.
 * Uses the Agent SDK with MCP tools to list sessions, fetch summaries, and create a published post.
 */

import { getActiveSkillsForAgentType, buildSkillSystemPromptSuffix } from "../tools/skill-loader";
import { CHANGELOG_PROMPT } from "../prompts/changelog";
import { injectStyleProfile } from "@/lib/style/profile-injector";
import { createAgentMcpServer } from "../mcp-server-factory";
import { runAgentStreaming } from "../agent-runner";

/** Input parameters for the changelog writer agent. */
interface ChangelogWriterInput {
  /** Workspace to read sessions from and publish the changelog post to. */
  workspaceId: string;
  /** Number of past days to include in the changelog. */
  lookbackDays: number;
  /** Optional project name to narrow the session query. */
  projectFilter?: string;
  /** Optional extra instructions appended to the agent prompt. */
  customInstructions?: string;
}


export async function streamChangelogWriter(input: ChangelogWriterInput): Promise<Response> {
  const activeSkills = await getActiveSkillsForAgentType(input.workspaceId, "changelog");
  const styleInjectedPrompt = await injectStyleProfile(CHANGELOG_PROMPT, input.workspaceId);
  const systemPrompt = styleInjectedPrompt + buildSkillSystemPromptSuffix(activeSkills);

  const userMessage = input.customInstructions
    ? `Generate a changelog for the last ${input.lookbackDays} days${input.projectFilter ? ` for project "${input.projectFilter}"` : ""}. First list sessions in the timeframe, then get summaries for each, then create a changelog post. When calling create_post, set aiDraftMarkdown equal to the markdown content.\n\nAdditional instructions: ${input.customInstructions}`
    : `Generate a changelog for the last ${input.lookbackDays} days${input.projectFilter ? ` for project "${input.projectFilter}"` : ""}. First use list_sessions_by_timeframe, then get_session_summary for notable sessions, then create a changelog post with create_post. When calling create_post, set aiDraftMarkdown equal to the markdown content.`;

  const mcpServer = createAgentMcpServer("changelog-writer", input.workspaceId);

  return runAgentStreaming(
    {
      agentType: "changelog-writer",
      workspaceId: input.workspaceId,
      systemPrompt,
      userMessage,
      mcpServer,
    },
    {
      lookbackDays: input.lookbackDays,
      projectFilter: input.projectFilter,
    },
  );
}
