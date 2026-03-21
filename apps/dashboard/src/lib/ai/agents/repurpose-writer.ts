/**
 * Repurpose writer agent that converts content between formats:
 * - Blog posts → social (Twitter thread, LinkedIn post, changelog, TL;DR)
 * - Blog posts → newsletter section or documentation page
 * - Social posts → blog (reverse repurposing)
 */

import { TWITTER_FROM_POST_PROMPT } from "../prompts/repurpose/twitter-from-post";
import { LINKEDIN_FROM_POST_PROMPT } from "../prompts/repurpose/linkedin-from-post";
import { NEWSLETTER_SECTION_FROM_POST_PROMPT } from "../prompts/repurpose/newsletter-section-from-post";
import { DOC_PAGE_FROM_POST_PROMPT } from "../prompts/repurpose/doc-page-from-post";
import { CHANGELOG_FROM_POST_PROMPT } from "../prompts/repurpose/changelog-from-post";
import { TLDR_PROMPT } from "../prompts/repurpose/tldr";
import { BLOG_FROM_SOCIAL_PROMPT } from "../prompts/repurpose/blog-from-social";
import { injectStyleProfile } from "@/lib/style/profile-injector";
import { createAgentMcpServer } from "../mcp-server-factory";
import { runAgentStreaming } from "../agent-runner";

type TargetFormat =
  | "twitter_thread"
  | "linkedin_post"
  | "changelog"
  | "tldr"
  | "blog_post"
  | "newsletter"
  | "doc_page";

const PROMPTS: Record<TargetFormat, string> = {
  twitter_thread: TWITTER_FROM_POST_PROMPT,
  linkedin_post: LINKEDIN_FROM_POST_PROMPT,
  changelog: CHANGELOG_FROM_POST_PROMPT,
  tldr: TLDR_PROMPT,
  blog_post: BLOG_FROM_SOCIAL_PROMPT,
  newsletter: NEWSLETTER_SECTION_FROM_POST_PROMPT,
  doc_page: DOC_PAGE_FROM_POST_PROMPT,
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
  newsletter: "custom",
  doc_page: "custom",
};

const FORMAT_LABELS: Record<TargetFormat, string> = {
  twitter_thread: "Twitter thread",
  linkedin_post: "LinkedIn post",
  changelog: "changelog entry",
  tldr: "TL;DR summary",
  blog_post: "blog post",
  newsletter: "newsletter section",
  doc_page: "documentation page",
};

interface RepurposeWriterInput {
  workspaceId: string;
  sourcePostId: string;
  targetFormat: TargetFormat;
  customInstructions?: string;
}

export async function streamRepurposeWriter(input: RepurposeWriterInput): Promise<Response> {
  const basePrompt = PROMPTS[input.targetFormat];
  const systemPrompt = await injectStyleProfile(basePrompt, input.workspaceId);
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
