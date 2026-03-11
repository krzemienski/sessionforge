/**
 * Repurpose writer agent that converts content between formats:
 * - Blog posts → social (Twitter thread, LinkedIn post, changelog, TL;DR)
 * - Social posts → blog (reverse repurposing)
 */

import { TWITTER_THREAD_PROMPT } from "../prompts/social/twitter-thread";
import { LINKEDIN_PROMPT } from "../prompts/social/linkedin-post";
import { CHANGELOG_FROM_POST_PROMPT } from "../prompts/repurpose/changelog-from-post";
import { TLDR_PROMPT } from "../prompts/repurpose/tldr";
import { BLOG_FROM_SOCIAL_PROMPT } from "../prompts/repurpose/blog-from-social";
import { createAgentMcpServer } from "../mcp-server-factory";
import { runAgentStreaming } from "../agent-runner";

type TargetFormat = "twitter_thread" | "linkedin_post" | "changelog" | "tldr" | "blog_post";

const PROMPTS: Record<TargetFormat, string> = {
  twitter_thread: TWITTER_THREAD_PROMPT,
  linkedin_post: LINKEDIN_PROMPT,
  changelog: CHANGELOG_FROM_POST_PROMPT,
  tldr: TLDR_PROMPT,
  blog_post: BLOG_FROM_SOCIAL_PROMPT,
};

const CONTENT_TYPES: Record<
  TargetFormat,
  "twitter_thread" | "linkedin_post" | "changelog" | "custom" | "blog_post"
> = {
  twitter_thread: "twitter_thread",
  linkedin_post: "linkedin_post",
  changelog: "changelog",
  tldr: "custom",
  blog_post: "blog_post",
};

const FORMAT_LABELS: Record<TargetFormat, string> = {
  twitter_thread: "Twitter thread",
  linkedin_post: "LinkedIn post",
  changelog: "changelog entry",
  tldr: "TL;DR summary",
  blog_post: "blog post",
};

interface RepurposeWriterInput {
  workspaceId: string;
  sourcePostId: string;
  targetFormat: TargetFormat;
  customInstructions?: string;
}

export function streamRepurposeWriter(input: RepurposeWriterInput): Response {
  const systemPrompt = PROMPTS[input.targetFormat];
  const formatLabel = FORMAT_LABELS[input.targetFormat];
  const contentType = CONTENT_TYPES[input.targetFormat];

  const baseInstruction = `Create a ${formatLabel} from the blog post with ID "${input.sourcePostId}". First fetch the post content using get_post. Then create the derived post using create_post. When calling create_post, set content_type to "${contentType}", set parentPostId to "${input.sourcePostId}", and set sourceMetadata to include parentPostId: "${input.sourcePostId}" and generatedBy: "repurpose_writer".`;
  const userMessage = input.customInstructions
    ? `${baseInstruction}\n\nAdditional instructions: ${input.customInstructions}`
    : baseInstruction;

  const mcpServer = createAgentMcpServer("repurpose-writer", input.workspaceId);

  return runAgentStreaming(
    {
      agentType: "repurpose-writer",
      workspaceId: input.workspaceId,
      systemPrompt,
      userMessage,
      mcpServer,
      trackRun: false,
    },
  );
}
