/**
 * GET /api/observability/runs/[id]
 *
 * Returns a single automationRun with full context:
 * - run: full run record with trigger info
 * - events: associated agentEvents during the run's time window
 * - agentRuns: associated agentRuns during the run's time window
 * - publishStatus: scheduled publication status if postId exists
 */

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  automationRuns,
  agentEvents,
  agentRuns,
  posts,
  workspaces,
} from "@sessionforge/db";
import { and, eq, gte, lte, desc, asc } from "drizzle-orm/sql";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Fetch the automation run with its trigger relation
  const run = await db.query.automationRuns.findFirst({
    where: eq(automationRuns.id, id),
    with: { trigger: true },
  });

  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  // Verify workspace ownership
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, run.workspaceId),
  });

  if (!workspace || workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  // Build time window conditions for related queries
  const timeConditions = [eq(agentEvents.workspaceId, workspace.id)];
  if (run.startedAt) {
    timeConditions.push(gte(agentEvents.createdAt, run.startedAt));
  }
  if (run.completedAt) {
    timeConditions.push(lte(agentEvents.createdAt, run.completedAt));
  }

  // Fetch associated agent events within the run's time window
  const events = await db
    .select()
    .from(agentEvents)
    .where(and(...timeConditions))
    .orderBy(asc(agentEvents.createdAt))
    .limit(500);

  // Build time window conditions for agent runs
  const agentRunConditions = [eq(agentRuns.workspaceId, workspace.id)];
  if (run.startedAt) {
    agentRunConditions.push(gte(agentRuns.startedAt, run.startedAt));
  }
  if (run.completedAt) {
    agentRunConditions.push(lte(agentRuns.startedAt, run.completedAt));
  }

  // Fetch associated agent runs within the run's time window
  const relatedAgentRuns = await db
    .select()
    .from(agentRuns)
    .where(and(...agentRunConditions))
    .orderBy(asc(agentRuns.startedAt));

  // Fetch publish status if a postId exists
  let publishStatus = null;
  if (run.postId) {
    const post = await db.query.posts.findFirst({
      where: eq(posts.id, run.postId),
    });
    if (post) {
      publishStatus = {
        postId: post.id,
        title: post.title,
        status: post.status,
        contentType: post.contentType,
        publishedAt: post.publishedAt,
        createdAt: post.createdAt,
      };
    }
  }

  // Destructure trigger from run for the response
  const { trigger, ...runData } = run;

  return NextResponse.json({
    run: {
      ...runData,
      triggerName: trigger?.name ?? null,
      triggerType: trigger?.triggerType ?? null,
    },
    events,
    agentRuns: relatedAgentRuns,
    publishStatus,
  });
}
