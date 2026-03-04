/**
 * Social writer agent for generating platform-specific social media content.
 * Uses the Agent SDK with MCP tools to fetch insight data and save drafted posts via SSE streaming.
 */

import { getActiveSkillsForAgentType, buildSkillSystemPromptSuffix } from "../tools/skill-loader";
import { TWITTER_THREAD_PROMPT } from "../prompts/social/twitter-thread";
import { LINKEDIN_PROMPT } from "../prompts/social/linkedin-post";
import { injectStyleProfile } from "@/lib/style/profile-injector";
import { createAgentMcpServer } from "../mcp-server-factory";
import { runAgentStreaming } from "../agent-runner";

/** Supported social media platforms for post generation. */
type SocialPlatform = "twitter" | "linkedin";

const PROMPTS: Record<SocialPlatform, string> = {
  twitter: TWITTER_THREAD_PROMPT,
  linkedin: LINKEDIN_PROMPT,
};

const CONTENT_TYPES: Record<SocialPlatform, "twitter_thread" | "linkedin_post"> = {
  twitter: "twitter_thread",
  linkedin: "linkedin_post",
};

/** Input parameters for the social writer agent. */
interface SocialWriterInput {
  /** Workspace context used to scope tool calls. */
  workspaceId: string;
  /** ID of the insight to base the social post on. */
  insightId: string;
  /** Target platform that determines the prompt and content type. */
  platform: SocialPlatform;
  /** Optional freeform guidance appended to the agent's user message. */
  customInstructions?: string;
}


export async function streamSocialWriter(input: SocialWriterInput): Promise<Response> {
  const activeSkills = await getActiveSkillsForAgentType(input.workspaceId, "social");
  const styleInjectedPrompt = await injectStyleProfile(PROMPTS[input.platform], input.workspaceId);
  const systemPrompt = styleInjectedPrompt + buildSkillSystemPromptSuffix(activeSkills);

  const userMessage = input.customInstructions
    ? `Create a ${input.platform} post about insight "${input.insightId}". First fetch insight details. Then create the post with content_type "${CONTENT_TYPES[input.platform]}". When calling create_post, set aiDraftMarkdown equal to the markdown content.\n\nAdditional instructions: ${input.customInstructions}`
    : `Create a ${input.platform} post about insight "${input.insightId}". First fetch insight details and session data. Then save it with create_post using content_type "${CONTENT_TYPES[input.platform]}". When calling create_post, set aiDraftMarkdown equal to the markdown content.`;

  const mcpServer = createAgentMcpServer("social-writer", input.workspaceId);

  return runAgentStreaming(
    {
      agentType: "social-writer",
      workspaceId: input.workspaceId,
      systemPrompt,
      userMessage,
      mcpServer,
    },
    {
      insightId: input.insightId,
      platform: input.platform,
    },
  );
}
