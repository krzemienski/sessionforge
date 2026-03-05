/**
 * Evidence MCP tools — expose Phase 2 session mining to agents.
 *
 * Tools:
 *  - mine_sessions: fuzzy-search + classify session evidence for a topic
 *  - get_evidence_detail: fetch full message context for an evidence item
 *  - get_evidence_timeline: arrange evidence items chronologically
 */

import { db } from "@/lib/db";
import { claudeSessions } from "@sessionforge/db";
import { eq, and, inArray } from "drizzle-orm/sql";
import { SessionMiner } from "@/lib/sessions/miner";
import { classifyEvidence } from "@/lib/sessions/evidence-classifier";

// ── mine_sessions ──────────────────────────────────────────────────────────

async function mineSessions(
  workspaceId: string,
  topic: string,
  limit = 20
) {
  const miner = new SessionMiner(workspaceId);
  const hits = await miner.search(topic, limit);
  const evidence = await classifyEvidence(hits, topic);
  evidence.sort((a, b) => b.relevanceScore - a.relevanceScore);
  return { topic, evidence, totalFound: evidence.length };
}

// ── get_evidence_detail ────────────────────────────────────────────────────

interface RawMessage {
  role?: string;
  content?: string | Array<{ type: string; text?: string }>;
  timestamp?: string;
}

function extractText(content: RawMessage["content"]): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  return content
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text!)
    .join(" ");
}

async function getEvidenceDetail(
  workspaceId: string,
  sessionId: string,
  messageIndex: number,
  contextWindow = 3
) {
  const session = await db.query.claudeSessions.findFirst({
    where: and(
      eq(claudeSessions.sessionId, sessionId),
      eq(claudeSessions.workspaceId, workspaceId)
    ),
  });

  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  const raw = session.rawMetadata as { messages?: RawMessage[] } | null;
  const messages = raw?.messages ?? [];

  const start = Math.max(0, messageIndex - contextWindow);
  const end = Math.min(messages.length - 1, messageIndex + contextWindow);

  const contextMessages = messages.slice(start, end + 1).map((msg, i) => ({
    index: start + i,
    role: msg.role ?? "unknown",
    content: extractText(msg.content),
    timestamp: msg.timestamp ?? null,
    isTarget: start + i === messageIndex,
  }));

  return {
    sessionId,
    sessionFile: session.filePath,
    projectName: session.projectName,
    targetMessageIndex: messageIndex,
    contextMessages,
  };
}

// ── get_evidence_timeline ──────────────────────────────────────────────────

async function getEvidenceTimeline(workspaceId: string, sessionIds: string[]) {
  if (sessionIds.length === 0) return { timeline: [] };

  const sessions = await db
    .select({
      id: claudeSessions.id,
      sessionId: claudeSessions.sessionId,
      projectName: claudeSessions.projectName,
      filePath: claudeSessions.filePath,
      startedAt: claudeSessions.startedAt,
      endedAt: claudeSessions.endedAt,
      summary: claudeSessions.summary,
      messageCount: claudeSessions.messageCount,
    })
    .from(claudeSessions)
    .where(
      and(
        eq(claudeSessions.workspaceId, workspaceId),
        inArray(claudeSessions.sessionId, sessionIds)
      )
    );

  const timeline = sessions
    .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
    .map((s) => ({
      sessionId: s.sessionId,
      projectName: s.projectName,
      filePath: s.filePath,
      startedAt: s.startedAt.toISOString(),
      endedAt: s.endedAt?.toISOString() ?? null,
      summary: s.summary,
      messageCount: s.messageCount,
    }));

  return { timeline, totalSessions: timeline.length };
}

// ── Router ─────────────────────────────────────────────────────────────────

export async function handleEvidenceTool(
  workspaceId: string,
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<unknown> {
  switch (toolName) {
    case "mine_sessions":
      return mineSessions(
        workspaceId,
        toolInput.topic as string,
        (toolInput.limit as number | undefined) ?? 20
      );

    case "get_evidence_detail":
      return getEvidenceDetail(
        workspaceId,
        toolInput.sessionId as string,
        toolInput.messageIndex as number,
        (toolInput.contextWindow as number | undefined) ?? 3
      );

    case "get_evidence_timeline":
      return getEvidenceTimeline(
        workspaceId,
        toolInput.sessionIds as string[]
      );

    default:
      throw new Error(`Unknown evidence tool: ${toolName}`);
  }
}
