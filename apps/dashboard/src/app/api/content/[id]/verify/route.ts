import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts } from "@sessionforge/db";
import type { RiskFlag } from "@sessionforge/db";
import { eq } from "drizzle-orm";
import { runAgent } from "@/lib/ai/agent-runner";
import { createAgentMcpServer } from "@/lib/ai/mcp-server-factory";
import { getClaimVerifierPrompt } from "@/lib/ai/agents/claim-verifier";

export const dynamic = "force-dynamic";

/**
 * POST /api/content/[id]/verify
 *
 * Triggers the claim verification agent on a post's markdown content.
 * Extracts factual claims, cross-references them against session evidence,
 * and stores the resulting RiskFlag[] in the post's riskFlags JSONB column.
 * Updates verificationStatus to 'verified' or 'has_issues'.
 *
 * Body (optional): { force?: boolean }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const post = await db.query.posts.findFirst({
    where: eq(posts.id, id),
    columns: {
      id: true,
      title: true,
      markdown: true,
      workspaceId: true,
      verificationStatus: true,
      riskFlags: true,
    },
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const { force = false } = body as { force?: boolean };

  // Skip re-verification if already verified and force is not requested
  if (!force && post.verificationStatus !== "unverified" && post.verificationStatus !== null) {
    return NextResponse.json({
      message: "Verification already complete",
      id,
      verificationStatus: post.verificationStatus,
      riskFlags: (post.riskFlags as RiskFlag[]) ?? [],
    });
  }

  // Mark as pending while the agent runs
  await db
    .update(posts)
    .set({ verificationStatus: "pending" })
    .where(eq(posts.id, id));

  try {
    // Build the claim-verifier agent prompt
    const { systemPrompt, userMessage } = getClaimVerifierPrompt(
      post.title,
      post.markdown,
    );

    // Create the MCP server with verification tools for the agent
    const mcpServer = createAgentMcpServer("claim-verifier", post.workspaceId);

    // Run the claim-verifier agent
    const result = await runAgent({
      agentType: "claim-verifier",
      workspaceId: post.workspaceId,
      systemPrompt,
      userMessage,
      mcpServer,
      maxTurns: 10,
      trackRun: true,
    });

    // After the agent runs, fetch the updated post to get the stored flags
    const updatedPost = await db.query.posts.findFirst({
      where: eq(posts.id, id),
      columns: {
        id: true,
        verificationStatus: true,
        riskFlags: true,
      },
    });

    const flags = (updatedPost?.riskFlags as RiskFlag[]) ?? [];
    const verificationStatus = updatedPost?.verificationStatus ?? "verified";

    return NextResponse.json({
      id,
      verificationStatus,
      riskFlags: flags,
      agentOutput: result.text,
      toolsUsed: result.toolResults.map((t) => t.tool),
    });
  } catch (error) {
    // Revert to unverified on failure
    await db
      .update(posts)
      .set({ verificationStatus: "unverified" })
      .where(eq(posts.id, id));

    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Verification failed", details: errorMessage },
      { status: 500 },
    );
  }
}
