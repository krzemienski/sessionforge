import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { claudeSessions, workspaces } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";
import { withApiHandler } from "@/lib/api-handler";
import { parseBody, insightExtractSchema } from "@/lib/validation";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { fireWebhookEvent } from "@/lib/webhooks/events";
import { checkQuota, recordUsage } from "@/lib/billing/usage";
import { createAgentMcpServer } from "@/lib/ai/mcp-server-factory";
import { runAgentStreaming } from "@/lib/ai/agent-runner";
import { INSIGHT_EXTRACTION_PROMPT } from "@/lib/ai/prompts/insight-extraction";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Auth + validation outside withApiHandler so we can return SSE on success
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON", code: "VALIDATION_ERROR" }, { status: 400 });
  }

  let parsed: { sessionIds: string[]; workspaceSlug: string };
  try {
    parsed = parseBody(insightExtractSchema, rawBody);
  } catch (e: unknown) {
    const err = e as { statusCode?: number; message?: string; meta?: unknown };
    return NextResponse.json(
      { error: err.message ?? "Validation failed", code: "VALIDATION_ERROR", details: err.meta },
      { status: err.statusCode ?? 400 }
    );
  }

  const { sessionIds, workspaceSlug } = parsed;

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, workspaceSlug),
  });

  if (!workspace || workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Workspace not found", code: "NOT_FOUND" }, { status: 404 });
  }

  const quota = await checkQuota(session.user.id, "insight_extraction");
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: "Monthly insight extraction quota exceeded",
        quota: { limit: quota.limit, remaining: quota.remaining, percentUsed: quota.percentUsed },
      },
      { status: 402 }
    );
  }

  // Resolve DB row IDs to Claude session IDs for the MCP tools
  const dbSession = await db
    .select({ id: claudeSessions.id, sessionId: claudeSessions.sessionId })
    .from(claudeSessions)
    .where(eq(claudeSessions.id, sessionIds[0]))
    .limit(1);

  if (!dbSession.length) {
    return NextResponse.json({ error: "Session not found", code: "NOT_FOUND" }, { status: 404 });
  }

  const claudeSessionId = dbSession[0].sessionId;

  // Record usage
  void recordUsage(session.user.id, workspace.id, "insight_extraction", 0.01);

  // Stream the agent execution via SSE
  const mcpServer = createAgentMcpServer("insight-extractor", workspace.id);

  return runAgentStreaming(
    {
      agentType: "insight-extractor",
      workspaceId: workspace.id,
      systemPrompt: INSIGHT_EXTRACTION_PROMPT,
      userMessage: `Analyze session "${claudeSessionId}" and extract the most valuable insight. First use get_session_summary and get_session_messages to understand the session, then use create_insight to save it.`,
      mcpServer,
    },
    {
      sessionId: claudeSessionId,
      workspaceId: workspace.id,
      dbSessionId: sessionIds[0],
    },
  );
}
