/**
 * Changelog writer agent that summarizes recent sessions into a changelog post.
 * Uses the Agent SDK with MCP tools to list sessions, fetch summaries, and create a published post.
 */

import { getActiveSkillsForAgentType, buildSkillSystemPromptSuffix } from "../tools/skill-loader";
import { CHANGELOG_PROMPT } from "../prompts/changelog";
import { injectStyleProfile } from "@/lib/style/profile-injector";
import { createAgentMcpServer } from "../mcp-server-factory";
import { runAgentStreaming } from "../agent-runner";
import { getTemplateBySlug } from "@/lib/templates";
import { getTemplateById, incrementTemplateUsage } from "@/lib/templates/db-operations";
import type { ContentTemplate, BuiltInTemplate } from "@/types/templates";

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
  /** Optional template slug to use as scaffolding for the changelog post. */
  templateId?: string;
}


export async function streamChangelogWriter(input: ChangelogWriterInput): Promise<Response> {
  const activeSkills = await getActiveSkillsForAgentType(input.workspaceId, "changelog");
  const styleInjectedPrompt = await injectStyleProfile(CHANGELOG_PROMPT, input.workspaceId);
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
  instructions.push(`\n${template.description}\n`);

  if (template.structure?.sections && template.structure.sections.length > 0) {
    instructions.push("### Required Structure");
    instructions.push("\nYour changelog post MUST follow this structure:\n");

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
