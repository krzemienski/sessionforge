/**
 * Research MCP tools — expose per-post research notebook to agents.
 *
 * Tools:
 *  - get_research_notebook: list all research items for a post
 *  - get_research_item: fetch full detail of a single research item by ID
 */

import { db } from "@/lib/db";
import { researchItems } from "@sessionforge/db";
import { eq, and } from "drizzle-orm/sql";

// ── get_research_notebook ──────────────────────────────────────────────────

async function getResearchNotebook(
  workspaceId: string,
  postId: string,
  tag?: string
) {
  const items = await db
    .select({
      id: researchItems.id,
      type: researchItems.type,
      title: researchItems.title,
      content: researchItems.content,
      url: researchItems.url,
      tags: researchItems.tags,
      credibilityRating: researchItems.credibilityRating,
      sessionId: researchItems.sessionId,
      messageIndex: researchItems.messageIndex,
      metadata: researchItems.metadata,
      createdAt: researchItems.createdAt,
      updatedAt: researchItems.updatedAt,
    })
    .from(researchItems)
    .where(
      and(
        eq(researchItems.workspaceId, workspaceId),
        eq(researchItems.postId, postId)
      )
    );

  const filtered = tag
    ? items.filter((item) => item.tags?.includes(tag))
    : items;

  return {
    postId,
    items: filtered.map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      content: item.content
        ? item.content.slice(0, 500) + (item.content.length > 500 ? "…" : "")
        : null,
      url: item.url,
      tags: item.tags,
      credibilityRating: item.credibilityRating,
      sessionId: item.sessionId,
      messageIndex: item.messageIndex,
      createdAt: item.createdAt?.toISOString() ?? null,
    })),
    totalItems: filtered.length,
  };
}

// ── get_research_item ──────────────────────────────────────────────────────

async function getResearchItem(workspaceId: string, itemId: string) {
  const item = await db.query.researchItems.findFirst({
    where: and(
      eq(researchItems.id, itemId),
      eq(researchItems.workspaceId, workspaceId)
    ),
  });

  if (!item) {
    throw new Error(`Research item ${itemId} not found`);
  }

  return {
    id: item.id,
    postId: item.postId,
    type: item.type,
    title: item.title,
    content: item.content,
    url: item.url,
    tags: item.tags,
    credibilityRating: item.credibilityRating,
    sessionId: item.sessionId,
    messageIndex: item.messageIndex,
    metadata: item.metadata,
    createdAt: item.createdAt?.toISOString() ?? null,
    updatedAt: item.updatedAt?.toISOString() ?? null,
  };
}

// ── Router ─────────────────────────────────────────────────────────────────

export async function handleResearchTool(
  workspaceId: string,
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<unknown> {
  switch (toolName) {
    case "get_research_notebook":
      return getResearchNotebook(
        workspaceId,
        toolInput.postId as string,
        toolInput.tag as string | undefined
      );

    case "get_research_item":
      return getResearchItem(workspaceId, toolInput.itemId as string);

    default:
      throw new Error(`Unknown research tool: ${toolName}`);
  }
}
