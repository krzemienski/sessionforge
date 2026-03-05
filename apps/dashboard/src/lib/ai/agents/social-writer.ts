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
import { getTemplateBySlug } from "@/lib/templates";
import { getTemplateById, incrementTemplateUsage } from "@/lib/templates/db-operations";
import type { ContentTemplate, BuiltInTemplate } from "@/types/templates";

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
  /** Optional template slug to use as scaffolding for the social post. */
  templateId?: string;
}


export async function streamSocialWriter(input: SocialWriterInput): Promise<Response> {
  const activeSkills = await getActiveSkillsForAgentType(input.workspaceId, "social");
  const styleInjectedPrompt = await injectStyleProfile(PROMPTS[input.platform], input.workspaceId);
  let systemPrompt = styleInjectedPrompt + buildSkillSystemPromptSuffix(activeSkills);

  // Fetch and apply template if provided
  // Try database template first (by ID), then fall back to built-in (by slug)
  if (input.templateId) {
    let template: ContentTemplate | BuiltInTemplate | null = null;
    const dbTemplate = await getTemplateById(input.templateId);
    if (dbTemplate) {
      template = dbTemplate;
      // Fire-and-forget usage tracking
      void incrementTemplateUsage(dbTemplate.id);
    } else {
      template = getTemplateBySlug(input.templateId) ?? null;
    }
    if (template) {
      const templateInstructions = buildTemplateInstructions(template);
      systemPrompt = `${systemPrompt}\n\n${templateInstructions}`;
    }
  }

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

/**
 * Builds template-specific instructions from a template definition.
 * Converts template structure and tone guidance into prompt instructions
 * that guide the AI in following the template format.
 *
 * @param template - The template to build instructions from (database or built-in).
 * @returns Formatted instructions string to append to the system prompt.
 */
function buildTemplateInstructions(
  template: ContentTemplate | BuiltInTemplate | null
): string {
  if (!template) return "";

  const instructions: string[] = [];

  instructions.push(`## Content Template: ${template.name}`);
  const description = template.description ?? '';
  if (description) {
    instructions.push(`\n${description}\n`);
  }

  if (template.structure?.sections && template.structure.sections.length > 0) {
    instructions.push("### Required Structure");
    instructions.push("\nYour social post MUST follow this structure:\n");

    template.structure.sections.forEach((section, index) => {
      const requiredLabel = section.required ? "(REQUIRED)" : "(OPTIONAL)";
      instructions.push(`${index + 1}. **${section.heading}** ${requiredLabel}`);
      instructions.push(`   ${section.description}`);
      instructions.push("");
    });
  }

  if (template.toneGuidance) {
    instructions.push("### Tone and Style Guidance");
    instructions.push(`\n${template.toneGuidance}\n`);
  }

  if (template.exampleContent) {
    instructions.push("### Example Format");
    instructions.push("\nHere's an example of how this template should look:\n");
    instructions.push("```markdown");
    instructions.push(template.exampleContent.substring(0, 500) + "...");
    instructions.push("```\n");
  }

  instructions.push("**Important:** Use the template structure as scaffolding, but fill it with content based on the actual insight data you fetch. The template provides the format and guidance, not the content itself.");

  return instructions.join("\n");
}
