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
import { getTemplateBySlug } from "@/lib/templates";
import { getTemplateById, incrementTemplateUsage } from "@/lib/templates/db-operations";
import type { ContentTemplate, BuiltInTemplate } from "@/types/templates";

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
  /** Optional template slug to use as scaffolding for the blog post. */
  templateId?: string;
}


export async function streamBlogWriter(input: BlogWriterInput): Promise<Response> {
  const activeSkills = await getActiveSkillsForAgentType(input.workspaceId, "blog");
  const styleInjectedPrompt = await injectStyleProfile(PROMPTS[input.tone ?? "technical"], input.workspaceId);
  let systemPrompt = styleInjectedPrompt + buildSkillSystemPromptSuffix(activeSkills);

  // Fetch and apply template if provided
  // Try database template first (by ID), then fall back to built-in (by slug)
  if (input.templateId) {
    let template: ContentTemplate | BuiltInTemplate | null = null;
    const dbTemplate = await getTemplateById(input.templateId);
    if (dbTemplate) {
      template = dbTemplate;
    } else {
      template = getTemplateBySlug(input.templateId) ?? null;
    }
    if (template) {
      const templateInstructions = buildTemplateInstructions(template);
      systemPrompt = `${systemPrompt}\n\n${templateInstructions}`;
    }
  }

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

/**
 * Builds template-specific instructions from a template definition.
 * Converts template structure and tone guidance into prompt instructions
 * that guide the AI in following the template format.
 *
 * @param template - The template to build instructions from (database or built-in).
 * @returns Formatted instructions string to append to the system prompt.
 */
function buildTemplateInstructions(
  template: ContentTemplate | BuiltInTemplate
): string {
  if (!template) return "";

  const instructions: string[] = [];

  instructions.push(`## Content Template: ${template.name}`);

  // Handle both ContentTemplate (with nullable description) and BuiltInTemplate
  const description = 'description' in template && template.description
    ? template.description
    : '';
  if (description) {
    instructions.push(`\n${description}\n`);
  }

  if (template.structure?.sections && template.structure.sections.length > 0) {
    instructions.push("### Required Structure");
    instructions.push("\nYour blog post MUST follow this structure:\n");

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
