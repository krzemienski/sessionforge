import { db } from "@/lib/db";
import { insights } from "@sessionforge/db";
import { eq, desc, gte, and } from "drizzle-orm";
import type { insightCategoryEnum } from "@sessionforge/db";

type InsightCategory = (typeof insightCategoryEnum.enumValues)[number];

export interface InsightScores {
  novelty: number;
  tool_discovery: number;
  before_after: number;
  failure_recovery: number;
  reproducibility: number;
  scale: number;
}

export interface CreateInsightInput {
  workspaceId: string;
  sessionId?: string;
  category: InsightCategory;
  title: string;
  description: string;
  codeSnippets?: { language: string; code: string; context: string }[];
  terminalOutput?: string[];
  scores: InsightScores;
}

function computeComposite(scores: InsightScores): number {
  const raw =
    scores.novelty * 3 +
    scores.tool_discovery * 3 +
    scores.before_after * 2 +
    scores.failure_recovery * 3 +
    scores.reproducibility * 1 +
    scores.scale * 1;
  return Math.min(raw, 65);
}

export async function getInsightDetails(workspaceId: string, insightId: string) {
  const insight = await db.query.insights.findFirst({
    where: and(
      eq(insights.id, insightId),
      eq(insights.workspaceId, workspaceId)
    ),
  });

  if (!insight) {
    throw new Error(`Insight ${insightId} not found`);
  }

  return insight;
}

export async function getTopInsights(
  workspaceId: string,
  limit = 10,
  minScore = 0
) {
  const results = await db.query.insights.findMany({
    where: and(
      eq(insights.workspaceId, workspaceId),
      gte(insights.compositeScore, minScore)
    ),
    orderBy: [desc(insights.compositeScore)],
    limit,
  });

  return results;
}

export async function createInsight(input: CreateInsightInput) {
  const composite = computeComposite(input.scores);

  const [created] = await db
    .insert(insights)
    .values({
      workspaceId: input.workspaceId,
      sessionId: input.sessionId,
      category: input.category,
      title: input.title,
      description: input.description,
      codeSnippets: input.codeSnippets ?? [],
      terminalOutput: input.terminalOutput ?? [],
      compositeScore: composite,
      noveltyScore: input.scores.novelty,
      toolPatternScore: input.scores.tool_discovery,
      transformationScore: input.scores.before_after,
      failureRecoveryScore: input.scores.failure_recovery,
      reproducibilityScore: input.scores.reproducibility,
      scaleScore: input.scores.scale,
    })
    .returning();

  return created;
}

// MCP tool definitions
export const insightTools = [
  {
    name: "get_insight_details",
    description: "Get full details of a specific insight by ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        insightId: { type: "string", description: "The insight ID" },
      },
      required: ["insightId"],
    },
  },
  {
    name: "get_top_insights",
    description:
      "Get top insights sorted by composite score, optionally filtered by minimum score.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Max results (default: 10)" },
        minScore: {
          type: "number",
          description: "Minimum composite score filter",
        },
      },
      required: [],
    },
  },
  {
    name: "create_insight",
    description: "Create a new insight record in the database.",
    input_schema: {
      type: "object" as const,
      properties: {
        sessionId: { type: "string" },
        category: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        codeSnippets: {
          type: "array",
          items: {
            type: "object",
            properties: {
              language: { type: "string" },
              code: { type: "string" },
              context: { type: "string" },
            },
          },
        },
        terminalOutput: { type: "array", items: { type: "string" } },
        scores: {
          type: "object",
          properties: {
            novelty: { type: "number" },
            tool_discovery: { type: "number" },
            before_after: { type: "number" },
            failure_recovery: { type: "number" },
            reproducibility: { type: "number" },
            scale: { type: "number" },
          },
          required: [
            "novelty",
            "tool_discovery",
            "before_after",
            "failure_recovery",
            "reproducibility",
            "scale",
          ],
        },
      },
      required: ["category", "title", "description", "scores"],
    },
  },
];

export async function handleInsightTool(
  workspaceId: string,
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<unknown> {
  switch (toolName) {
    case "get_insight_details":
      return getInsightDetails(workspaceId, toolInput.insightId as string);
    case "get_top_insights":
      return getTopInsights(
        workspaceId,
        toolInput.limit as number | undefined,
        toolInput.minScore as number | undefined
      );
    case "create_insight":
      return createInsight({
        workspaceId,
        ...(toolInput as Omit<CreateInsightInput, "workspaceId">),
      });
    default:
      throw new Error(`Unknown insight tool: ${toolName}`);
  }
}
