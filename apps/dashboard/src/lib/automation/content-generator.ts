/**
 * Background content generator for automated content pipelines.
 * Uses the Agent SDK with MCP tools to generate content from insights
 * and returns the created post ID.
 */

import { db } from "@/lib/db";
import { insights, posts } from "@sessionforge/db";
import { and, desc, eq } from "drizzle-orm/sql";
import { BLOG_TECHNICAL_PROMPT } from "../ai/prompts/blog/technical";
import { TWITTER_THREAD_PROMPT } from "../ai/prompts/social/twitter-thread";
import { LINKEDIN_PROMPT } from "../ai/prompts/social/linkedin-post";
import { CHANGELOG_PROMPT } from "../ai/prompts/changelog";
import { NEWSLETTER_PROMPT } from "../ai/prompts/newsletter";
import { createAgentMcpServer } from "../ai/mcp-server-factory";
import { runAgent } from "../ai/agent-runner";
import type { AgentType } from "../ai/orchestration/tool-registry";

/** Content types aligned with the DB enum `content_type` in schema.ts. */
export type ContentType =
  | "blog_post"
  | "twitter_thread"
  | "linkedin_post"
  | "devto_post"
  | "changelog"
  | "newsletter"
  | "custom";

interface GenerateContentInput {
  workspaceId: string;
  contentType: ContentType;
  insightIds?: string[];
  lookbackDays?: number;
  corpusSummary?: string;
}

interface ContentConfig {
  agentType: AgentType;
  systemPrompt: string;
  buildUserMessage: (input: GenerateContentInput, briefContext: string) => string;
}

/**
 * Fetches insight rows by ID and assembles a narrative context string
 * that gets injected into every writer's prompt.
 */
async function buildBriefContext(input: GenerateContentInput): Promise<string> {
  const sections: string[] = [];

  if (input.corpusSummary) {
    sections.push(
      "## Cross-Session Analysis\n" +
      input.corpusSummary
    );
  }

  if (input.insightIds?.length) {
    const insightSummaries: string[] = [];
    for (const id of input.insightIds) {
      try {
        const [insight] = await db
          .select()
          .from(insights)
          .where(
            and(
              eq(insights.id, id),
              eq(insights.workspaceId, input.workspaceId)
            )
          )
          .limit(1);
        if (insight) {
          const codeSnippets = insight.codeSnippets as Array<{ language: string; code: string; context: string }> | null;
          const terminalOutput = insight.terminalOutput as string[] | null;
          insightSummaries.push(
            `### ${insight.title} (score: ${insight.compositeScore}/65, category: ${insight.category})\n` +
            `${insight.description}\n` +
            (codeSnippets?.length
              ? `Code evidence: ${codeSnippets.length} snippet(s) available via get_insight_details("${id}")`
              : "") +
            (terminalOutput?.length
              ? `\nTerminal output: ${terminalOutput.length} entries available via get_insight_details("${id}")`
              : "")
          );
        }
      } catch {
        // Skip unavailable insights
      }
    }
    if (insightSummaries.length) {
      sections.push(
        "## Insights from Corpus Analysis\n" +
        insightSummaries.join("\n\n")
      );
    }
  }

  return sections.length
    ? "# Context: Cross-Session Intelligence\n\n" + sections.join("\n\n")
    : "";
}

const CONTENT_CONFIG: Record<ContentType, ContentConfig> = {
  blog_post: {
    agentType: "blog-writer",
    systemPrompt: BLOG_TECHNICAL_PROMPT,
    buildUserMessage: (input, briefContext) => {
      const ids = input.insightIds?.join('", "') ?? "";
      const base = briefContext
        ? `${briefContext}\n\n---\n\n`
        : "";
      return `${base}Write a deep technical blog post based on the cross-session patterns above.

Steps:
1. For each insight ID ("${ids}"), call get_insight_details to retrieve the full code snippets and terminal output.
2. Identify the narrative arc across sessions — what problem evolved, what was tried, what worked.
3. Use real code from the insights as inline examples (with syntax highlighting).
4. Structure: Problem → Approach → Key Decisions → Results → Takeaways.
5. Save the post with create_post using content_type "blog_post".

The story should connect sessions into a coherent journey, not summarize each session independently.`;
    },
  },
  twitter_thread: {
    agentType: "social-writer",
    systemPrompt: TWITTER_THREAD_PROMPT,
    buildUserMessage: (input, briefContext) => {
      const ids = input.insightIds ?? [];
      const firstId = ids[0] ?? "";
      const base = briefContext
        ? `${briefContext}\n\n---\n\n`
        : "";
      return `${base}Create a Twitter thread about the most surprising finding from the insights above.

Steps:
1. Review the insight summaries. Pick the ONE finding with the highest novelty or most unexpected outcome.
2. Call get_insight_details("${firstId}") to get the real code/terminal output for that insight.
3. Build a 7-12 tweet thread: Hook → Build the story → Code snippet → Takeaway → CTA.
4. Save with create_post using content_type "twitter_thread".

Focus on a single insight. Depth beats breadth on Twitter.`;
    },
  },
  linkedin_post: {
    agentType: "social-writer",
    systemPrompt: LINKEDIN_PROMPT,
    buildUserMessage: (_input, briefContext) => {
      const base = briefContext
        ? `${briefContext}\n\n---\n\n`
        : "";
      return `${base}Create a LinkedIn post about the professional lesson from the cross-session patterns above.

Steps:
1. From the insight summaries, identify the lesson a team lead would share — a process improvement, an architectural decision, or a debugging approach.
2. Call get_insight_details for the most relevant insight to get supporting evidence.
3. Frame it as "here's what I learned" — professional but human, not corporate.
4. Save with create_post using content_type "linkedin_post".

LinkedIn audience cares about the "why" and the team impact, not just the code.`;
    },
  },
  devto_post: {
    agentType: "blog-writer",
    systemPrompt: BLOG_TECHNICAL_PROMPT,
    buildUserMessage: (input, briefContext) => {
      const ids = input.insightIds?.join('", "') ?? "";
      const base = briefContext
        ? `${briefContext}\n\n---\n\n`
        : "";
      return `${base}Write a Dev.to tutorial based on the cross-session patterns above.

Steps:
1. For each insight ID ("${ids}"), call get_insight_details to get code snippets and terminal output.
2. Structure as a practical how-to: Problem → Step-by-step solution → Working code → Gotchas.
3. Dev.to readers want reproducible steps — include all imports, config, and setup.
4. Save with create_post using content_type "devto_post".

Prioritize code completeness. Every snippet should be copy-pasteable.`;
    },
  },
  changelog: {
    agentType: "changelog-writer",
    systemPrompt: CHANGELOG_PROMPT,
    buildUserMessage: (input, briefContext) => {
      const days = input.lookbackDays ?? 7;
      const base = briefContext
        ? `${briefContext}\n\n---\n\n`
        : "";
      return `${base}Generate a changelog for the last ${days} days.

Steps:
1. Use list_sessions_by_timeframe to get all sessions in the window.
2. Group changes by THEME (from the cross-session analysis above), not by individual session.
3. For each theme, call get_session_summary on the most representative sessions.
4. Show the evolution: what started as X, became Y, and landed as Z.
5. Save with create_post using content_type "changelog".

The cross-session patterns above reveal the themes. Use them as your grouping headers.`;
    },
  },
  newsletter: {
    agentType: "newsletter-writer",
    systemPrompt: NEWSLETTER_PROMPT,
    buildUserMessage: (input, briefContext) => {
      const days = input.lookbackDays ?? 7;
      const ids = input.insightIds?.join('", "') ?? "";
      const base = briefContext
        ? `${briefContext}\n\n---\n\n`
        : "";
      return `${base}Create a newsletter digest covering the last ${days} days.

Steps:
1. The cross-session analysis above identifies the key patterns. Use each pattern as a newsletter section.
2. For each insight ("${ids}"), call get_insight_details to get real code for the Code Spotlight.
3. Curate the top 3 patterns into highlights. Each should tell a mini-story with real evidence.
4. Lessons learned should come from the actual insight descriptions, not generic advice.
5. Save with create_post using content_type "newsletter".

Each section should cover one cross-session theme, not summarize individual sessions.`;
    },
  },
  custom: {
    agentType: "blog-writer",
    systemPrompt: BLOG_TECHNICAL_PROMPT,
    buildUserMessage: (input, briefContext) => {
      const ids = input.insightIds?.join('", "') ?? "";
      const base = briefContext
        ? `${briefContext}\n\n---\n\n`
        : "";
      return `${base}Create content based on the cross-session patterns above.

Steps:
1. For each insight ID ("${ids}"), call get_insight_details to get code and terminal output.
2. Synthesize the patterns into a coherent narrative with real evidence.
3. Save with create_post using content_type "custom".

Use the insight scores to prioritize: higher-scored insights should get more coverage.`;
    },
  },
};

export async function generateContent(
  input: GenerateContentInput,
): Promise<{ postId: string } | null> {
  const config = CONTENT_CONFIG[input.contentType];
  const briefContext = await buildBriefContext(input);

  const mcpServer = createAgentMcpServer(config.agentType, input.workspaceId);

  await runAgent(
    {
      agentType: config.agentType,
      workspaceId: input.workspaceId,
      systemPrompt: config.systemPrompt,
      userMessage: config.buildUserMessage(input, briefContext),
      mcpServer,
      trackRun: false,
    },
  );

  // Query the DB for the most recently created post by this workspace
  try {
    const [latest] = await db
      .select({ id: posts.id })
      .from(posts)
      .where(eq(posts.workspaceId, input.workspaceId))
      .orderBy(desc(posts.createdAt))
      .limit(1);

    if (latest) {
      return { postId: latest.id };
    }
  } catch {
    // DB query failure
  }

  return null;
}
