import { db } from "@/lib/db";
import { claudeSessions } from "@sessionforge/db";
import { eq, desc, gte, and } from "drizzle-orm/sql";

export interface SessionMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

export interface SessionSummaryResult {
  sessionId: string;
  projectName: string;
  projectPath: string;
  messageCount: number;
  toolsUsed: string[];
  filesModified: string[];
  errorsEncountered: string[];
  summary: string | null;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  costUsd: number | null;
}

export interface SessionListResult {
  id: string;
  sessionId: string;
  projectName: string;
  startedAt: string;
  messageCount: number;
  summary: string | null;
}

// Tool implementations — called by MCP tool handlers
export async function getSessionMessages(
  workspaceId: string,
  sessionId: string,
  limit = 100
): Promise<SessionMessage[]> {
  const session = await db.query.claudeSessions.findFirst({
    where: and(
      eq(claudeSessions.sessionId, sessionId),
      eq(claudeSessions.workspaceId, workspaceId)
    ),
  });

  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  // Raw metadata contains the actual messages from the JSONL file
  const raw = session.rawMetadata as { messages?: SessionMessage[] } | null;
  const messages = raw?.messages ?? [];
  return messages.slice(0, limit);
}

export async function getSessionSummary(
  workspaceId: string,
  sessionId: string
): Promise<SessionSummaryResult> {
  const session = await db.query.claudeSessions.findFirst({
    where: and(
      eq(claudeSessions.sessionId, sessionId),
      eq(claudeSessions.workspaceId, workspaceId)
    ),
  });

  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  return {
    sessionId: session.sessionId,
    projectName: session.projectName,
    projectPath: session.projectPath,
    messageCount: session.messageCount,
    toolsUsed: (session.toolsUsed as string[]) ?? [],
    filesModified: (session.filesModified as string[]) ?? [],
    errorsEncountered: (session.errorsEncountered as string[]) ?? [],
    summary: session.summary,
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt?.toISOString() ?? null,
    durationSeconds: session.durationSeconds,
    costUsd: session.costUsd ?? null,
  };
}

export async function listSessionsByTimeframe(
  workspaceId: string,
  lookbackDays: number,
  projectFilter?: string
): Promise<SessionListResult[]> {
  const since = new Date();
  since.setDate(since.getDate() - lookbackDays);

  const conditions = [
    eq(claudeSessions.workspaceId, workspaceId),
    gte(claudeSessions.startedAt, since),
  ];

  const results = await db
    .select({
      id: claudeSessions.id,
      sessionId: claudeSessions.sessionId,
      projectName: claudeSessions.projectName,
      startedAt: claudeSessions.startedAt,
      messageCount: claudeSessions.messageCount,
      summary: claudeSessions.summary,
    })
    .from(claudeSessions)
    .where(and(...conditions))
    .orderBy(desc(claudeSessions.startedAt));

  if (projectFilter) {
    return results
      .filter((s) =>
        s.projectName.toLowerCase().includes(projectFilter.toLowerCase())
      )
      .map((s) => ({
        ...s,
        startedAt: s.startedAt.toISOString(),
      }));
  }

  return results.map((s) => ({
    ...s,
    startedAt: s.startedAt.toISOString(),
  }));
}

// MCP tool definitions for use with Anthropic SDK tool_use
export const sessionReaderTools = [
  {
    name: "get_session_messages",
    description:
      "Retrieve messages from a specific Claude session by sessionId. Returns the conversation transcript.",
    input_schema: {
      type: "object" as const,
      properties: {
        sessionId: {
          type: "string",
          description: "The session ID to fetch messages for",
        },
        limit: {
          type: "number",
          description: "Maximum number of messages to return (default: 100)",
        },
      },
      required: ["sessionId"],
    },
  },
  {
    name: "get_session_summary",
    description:
      "Get metadata and summary for a specific Claude session including tools used, files modified, and errors.",
    input_schema: {
      type: "object" as const,
      properties: {
        sessionId: {
          type: "string",
          description: "The session ID to get summary for",
        },
      },
      required: ["sessionId"],
    },
  },
  {
    name: "list_sessions_by_timeframe",
    description:
      "List Claude sessions within a lookback window, optionally filtered by project name.",
    input_schema: {
      type: "object" as const,
      properties: {
        lookbackDays: {
          type: "number",
          description: "Number of days to look back",
        },
        projectFilter: {
          type: "string",
          description: "Optional project name filter (partial match)",
        },
      },
      required: ["lookbackDays"],
    },
  },
];

export async function handleSessionReaderTool(
  workspaceId: string,
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<unknown> {
  switch (toolName) {
    case "get_session_messages":
      return getSessionMessages(
        workspaceId,
        toolInput.sessionId as string,
        toolInput.limit as number | undefined
      );
    case "get_session_summary":
      return getSessionSummary(workspaceId, toolInput.sessionId as string);
    case "list_sessions_by_timeframe":
      return listSessionsByTimeframe(
        workspaceId,
        toolInput.lookbackDays as number,
        toolInput.projectFilter as string | undefined
      );
    default:
      throw new Error(`Unknown session reader tool: ${toolName}`);
  }
}
