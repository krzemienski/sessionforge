/**
 * Newsletter writer agent that generates email digest posts from recent sessions.
 * Uses the Agent SDK with MCP tools to list sessions by timeframe, aggregate top
 * insights, and create a newsletter post, streaming progress events over SSE.
 */

import { NEWSLETTER_PROMPT } from "../prompts/newsletter";
import { createAgentMcpServer } from "../mcp-server-factory";
import { runAgentStreaming } from "../agent-runner";
import { getTemplateBySlug } from "@/lib/templates";
import { getTemplateById, incrementTemplateUsage } from "@/lib/templates/db-operations";
import type { ContentTemplate, BuiltInTemplate } from "@/types/templates";

/** Input parameters for the newsletter writer agent. */
interface NewsletterWriterInput {
  /** Workspace to read sessions from and publish the newsletter post to. */
  workspaceId: string;
  /** Number of past days to include in the digest (typically 1, 7, or 30). */
  lookbackDays: number;
  /** Optional extra instructions appended to the agent prompt. */
  customInstructions?: string;
  /** Optional template slug to use as scaffolding for the newsletter post. */
  templateId?: string;
}

/**
 * Starts a streaming newsletter generation run and returns an SSE response.
 *
 * @param input - Configuration for the newsletter run.
 * @returns A streaming SSE {@link Response} with status, tool, and text events.
 */
export async function streamNewsletterWriter(input: NewsletterWriterInput): Promise<Response> {
  const userMessage = input.customInstructions
    ? `Generate a newsletter email digest for the last ${input.lookbackDays} day${input.lookbackDays === 1 ? "" : "s"}. First use list_sessions_by_timeframe to find sessions in the window, then use get_top_insights to surface the most interesting technical moments, then create a newsletter post with create_post using contentType "newsletter".\n\nAdditional instructions: ${input.customInstructions}`
    : `Generate a newsletter email digest for the last ${input.lookbackDays} day${input.lookbackDays === 1 ? "" : "s"}. First use list_sessions_by_timeframe to find sessions in the window, then use get_top_insights to surface the most interesting technical moments, then create a newsletter post with create_post using contentType "newsletter".`;

  let systemPrompt = NEWSLETTER_PROMPT;
  // Fetch and apply template if provided
  // Try database template first (by ID), then fall back to built-in (by slug)
  if (input.templateId) {
    const dbTemplate = await getTemplateById(input.templateId);
    let template: ContentTemplate | BuiltInTemplate | null = null;
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

  const mcpServer = createAgentMcpServer("newsletter-writer", input.workspaceId);

  return runAgentStreaming(
    {
      agentType: "newsletter-writer",
      workspaceId: input.workspaceId,
      systemPrompt,
      userMessage,
      mcpServer,
      trackRun: false,
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
    instructions.push("\nYour newsletter post MUST follow this structure:\n");

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

  instructions.push("**Important:** Use the template structure as scaffolding, but fill it with content based on the actual session data you fetch. The template provides the format and guidance, not the content itself.");

  return instructions.join("\n");
}
