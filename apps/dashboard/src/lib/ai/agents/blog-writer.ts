/**
 * Blog writer agent that generates blog posts from session insights.
 * Uses the Agent SDK with MCP tools to fetch insight data and create posts,
 * streaming progress events over SSE as the agent works.
 */

import { getActiveSkillsForAgentType, buildSkillSystemPromptSuffix } from "../tools/skill-loader";
import { BLOG_TECHNICAL_PROMPT } from "../prompts/blog/technical";
import { BLOG_TUTORIAL_PROMPT } from "../prompts/blog/tutorial";
import { BLOG_CONVERSATIONAL_PROMPT } from "../prompts/blog/conversational";
import { injectStyleProfile } from "@/lib/style/profile-injector";
import { createAgentMcpServer } from "../mcp-server-factory";
import { runAgentStreaming } from "../agent-runner";

/** Writing style applied to the generated blog post. */
type BlogTone = "technical" | "tutorial" | "conversational";

const PROMPTS: Record<BlogTone, string> = {
  technical: BLOG_TECHNICAL_PROMPT,
  tutorial: BLOG_TUTORIAL_PROMPT,
  conversational: BLOG_CONVERSATIONAL_PROMPT,
};

/** Input parameters for the blog writer agent. */
interface BlogWriterInput {
  /** ID of the workspace owning the insight and target post. */
  workspaceId: string;
  /** ID of the insight to base the blog post on. */
  insightId: string;
  /** Writing tone for the generated post. Defaults to "technical". */
  tone?: BlogTone;
  /** Optional freeform instructions appended to the agent's prompt. */
  customInstructions?: string;
}


export async function streamBlogWriter(input: BlogWriterInput): Promise<Response> {
  const activeSkills = await getActiveSkillsForAgentType(input.workspaceId, "blog");
  const styleInjectedPrompt = await injectStyleProfile(PROMPTS[input.tone ?? "technical"], input.workspaceId);
  const systemPrompt = styleInjectedPrompt + buildSkillSystemPromptSuffix(activeSkills);

  const userMessage = input.customInstructions
    ? `Write a blog post about insight "${input.insightId}". First fetch the insight details and related session data. Then create the post. When calling create_post, set aiDraftMarkdown equal to the markdown content.\n\nAdditional instructions: ${input.customInstructions}`
    : `Write a blog post about insight "${input.insightId}". First fetch the insight details and related session data. Then create the post using create_post. When calling create_post, set aiDraftMarkdown equal to the markdown content.`;

  const mcpServer = createAgentMcpServer("blog-writer", input.workspaceId);

  return runAgentStreaming(
    {
      agentType: "blog-writer",
      workspaceId: input.workspaceId,
      systemPrompt,
      userMessage,
      mcpServer,
    },
    {
      insightId: input.insightId,
      tone: input.tone ?? "technical",
      workspaceId: input.workspaceId,
    },
  );
}
