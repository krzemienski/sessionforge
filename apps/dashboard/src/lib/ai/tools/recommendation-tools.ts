import { db } from "@/lib/db";
import { contentRecommendations } from "@sessionforge/db";
import { eq, and, desc, asc } from "drizzle-orm";
import type { contentTypeEnum } from "@sessionforge/db";

type ContentType = (typeof contentTypeEnum.enumValues)[number];

type RecommendationStatus = "active" | "accepted" | "dismissed";

export interface CreateRecommendationInput {
  workspaceId: string;
  recommendationType: string;
  title: string;
  reasoning: string;
  suggestedContentType?: ContentType;
  suggestedPublishTime?: Date | string;
  insightId?: string;
  priority?: number;
  metadata?: {
    cadenceGap?: boolean;
    engagementPrediction?: number;
    relatedSessions?: string[];
    contentTypeMatch?: string;
    timezoneOptimized?: boolean;
  };
}

export interface UpdateRecommendationInput {
  status?: RecommendationStatus;
  priority?: number;
  metadata?: {
    cadenceGap?: boolean;
    engagementPrediction?: number;
    relatedSessions?: string[];
    contentTypeMatch?: string;
    timezoneOptimized?: boolean;
  };
}

export async function createRecommendation(input: CreateRecommendationInput) {
  const suggestedPublishTime =
    input.suggestedPublishTime
      ? new Date(input.suggestedPublishTime)
      : undefined;

  const [created] = await db
    .insert(contentRecommendations)
    .values({
      workspaceId: input.workspaceId,
      recommendationType: input.recommendationType,
      title: input.title,
      reasoning: input.reasoning,
      suggestedContentType: input.suggestedContentType,
      suggestedPublishTime,
      insightId: input.insightId,
      priority: input.priority ?? 0,
      status: "active",
      metadata: input.metadata,
    })
    .returning();

  return created;
}

export async function getRecommendations(
  workspaceId: string,
  status: RecommendationStatus = "active",
  limit = 10
) {
  const results = await db.query.contentRecommendations.findMany({
    where: and(
      eq(contentRecommendations.workspaceId, workspaceId),
      eq(contentRecommendations.status, status)
    ),
    orderBy: [desc(contentRecommendations.priority), asc(contentRecommendations.createdAt)],
    limit,
  });

  return results;
}

export async function getRecommendation(
  workspaceId: string,
  recommendationId: string
) {
  const recommendation = await db.query.contentRecommendations.findFirst({
    where: and(
      eq(contentRecommendations.id, recommendationId),
      eq(contentRecommendations.workspaceId, workspaceId)
    ),
  });

  if (!recommendation) {
    throw new Error(`Recommendation ${recommendationId} not found`);
  }

  return recommendation;
}

export async function updateRecommendationStatus(
  workspaceId: string,
  recommendationId: string,
  status: RecommendationStatus
) {
  const updates: Record<string, unknown> = { status };

  if (status === "accepted") {
    updates.acceptedAt = new Date();
  } else if (status === "dismissed") {
    updates.dismissedAt = new Date();
  }

  const [updated] = await db
    .update(contentRecommendations)
    .set(updates)
    .where(
      and(
        eq(contentRecommendations.id, recommendationId),
        eq(contentRecommendations.workspaceId, workspaceId)
      )
    )
    .returning();

  if (!updated) {
    throw new Error(`Recommendation ${recommendationId} not found`);
  }

  return updated;
}

// MCP tool definitions
export const recommendationTools = [
  {
    name: "create_recommendation",
    description:
      "Save an AI-generated content recommendation to the database with reasoning and metadata.",
    input_schema: {
      type: "object" as const,
      properties: {
        recommendationType: {
          type: "string",
          description:
            "Type of recommendation: 'cadence_gap', 'high_scoring_insight', 'content_type_match', 'optimal_publish_time'",
        },
        title: {
          type: "string",
          description: "Short, actionable recommendation title",
        },
        reasoning: {
          type: "string",
          description: "Detailed explanation of why this recommendation was generated",
        },
        suggestedContentType: {
          type: "string",
          description: "Recommended content type for this suggestion",
        },
        suggestedPublishTime: {
          type: "string",
          description: "ISO 8601 datetime for optimal publish time",
        },
        insightId: {
          type: "string",
          description: "ID of the insight this recommendation is based on (if applicable)",
        },
        priority: {
          type: "number",
          description: "Priority score 0-100 (higher = more important)",
        },
        metadata: {
          type: "object",
          description: "Additional metadata for the recommendation",
          properties: {
            cadenceGap: { type: "boolean" },
            engagementPrediction: { type: "number" },
            relatedSessions: { type: "array", items: { type: "string" } },
            contentTypeMatch: { type: "string" },
            timezoneOptimized: { type: "boolean" },
          },
        },
      },
      required: ["recommendationType", "title", "reasoning"],
    },
  },
  {
    name: "get_recommendations",
    description: "Fetch existing content recommendations filtered by status.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          description: "Filter by status: 'active', 'accepted', or 'dismissed' (default: 'active')",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return (default: 10)",
        },
      },
      required: [],
    },
  },
  {
    name: "get_recommendation",
    description: "Get a single recommendation by ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        recommendationId: {
          type: "string",
          description: "The recommendation ID",
        },
      },
      required: ["recommendationId"],
    },
  },
  {
    name: "update_recommendation_status",
    description: "Update the status of a recommendation to accepted or dismissed.",
    input_schema: {
      type: "object" as const,
      properties: {
        recommendationId: {
          type: "string",
          description: "The recommendation ID to update",
        },
        status: {
          type: "string",
          description: "New status: 'accepted' or 'dismissed'",
        },
      },
      required: ["recommendationId", "status"],
    },
  },
];

export async function handleRecommendationTool(
  workspaceId: string,
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<unknown> {
  switch (toolName) {
    case "create_recommendation":
      return createRecommendation({
        workspaceId,
        ...(toolInput as Omit<CreateRecommendationInput, "workspaceId">),
      });
    case "get_recommendations":
      return getRecommendations(
        workspaceId,
        (toolInput.status as RecommendationStatus | undefined) ?? "active",
        (toolInput.limit as number | undefined) ?? 10
      );
    case "get_recommendation":
      return getRecommendation(workspaceId, toolInput.recommendationId as string);
    case "update_recommendation_status":
      return updateRecommendationStatus(
        workspaceId,
        toolInput.recommendationId as string,
        toolInput.status as RecommendationStatus
      );
    default:
      throw new Error(`Unknown recommendation tool: ${toolName}`);
  }
}
