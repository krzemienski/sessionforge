/**
 * GET /api/observability/metrics
 *
 * Aggregated pipeline metrics for the observability dashboard.
 * Computes: job state counts, failure rate, throughput, avg duration,
 * queue depth, and per-stage latency from automationRuns + agentEvents.
 *
 * Query params:
 *   workspace (slug, required)
 *   since     (ISO date, optional — defaults to 30 days ago)
 *   until     (ISO date, optional — defaults to now)
 *   platform  (content type filter, optional — filters via contentTriggers)
 */

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  automationRuns,
  agentEvents,
  workspaces,
  contentTriggers,
} from "@sessionforge/db";
import { and, eq, gte, lte, sql, type SQL } from "drizzle-orm/sql";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = req.nextUrl.searchParams;
    const workspaceSlug = params.get("workspace");
    if (!workspaceSlug) {
      return NextResponse.json(
        { error: "workspace required" },
        { status: 400 },
      );
    }

    const [ws] = await db
      .select()
      .from(workspaces)
      .where(
        and(
          eq(workspaces.slug, workspaceSlug),
          eq(workspaces.ownerId, session.user.id),
        ),
      )
      .limit(1);

    if (!ws) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 },
      );
    }

    // Date range defaults: last 30 days → now
    const now = new Date();
    const defaultSince = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const sinceParam = params.get("since");
    const sinceDate =
      sinceParam && !isNaN(new Date(sinceParam).getTime())
        ? new Date(sinceParam)
        : defaultSince;

    const untilParam = params.get("until");
    const untilDate =
      untilParam && !isNaN(new Date(untilParam).getTime())
        ? new Date(untilParam)
        : now;

    const platform = params.get("platform");

    // ── Build automationRuns conditions ──────────────────────────────
    const runConditions: SQL[] = [
      eq(automationRuns.workspaceId, ws.id),
      gte(automationRuns.startedAt, sinceDate),
      lte(automationRuns.startedAt, untilDate),
    ];

    // Platform filter: join through contentTriggers.contentType
    if (platform) {
      runConditions.push(
        sql`${automationRuns.triggerId} IN (
          SELECT ${contentTriggers.id} FROM ${contentTriggers}
          WHERE ${contentTriggers.contentType} = ${platform}
        )`,
      );
    }

    const runWhere = and(...runConditions);

    // ── Fetch all matching runs ──────────────────────────────────────
    const runs = await db
      .select({
        id: automationRuns.id,
        status: automationRuns.status,
        durationMs: automationRuns.durationMs,
        startedAt: automationRuns.startedAt,
      })
      .from(automationRuns)
      .where(runWhere);

    // ── (1) Job state counts ─────────────────────────────────────────
    const stateCounts: Record<string, number> = {
      pending: 0,
      scanning: 0,
      extracting: 0,
      generating: 0,
      complete: 0,
      failed: 0,
    };
    for (const run of runs) {
      const s = run.status as string;
      if (s in stateCounts) {
        stateCounts[s]++;
      }
    }

    const total = runs.length;

    // ── (2) Failure rate ─────────────────────────────────────────────
    const failureRate = total > 0 ? stateCounts.failed / total : 0;

    // ── (3) Throughput (runs per day) ────────────────────────────────
    const rangeDays = Math.max(
      1,
      (untilDate.getTime() - sinceDate.getTime()) / (24 * 60 * 60 * 1000),
    );
    const throughput = total / rangeDays;

    // ── (4) Average duration ─────────────────────────────────────────
    const durationsMs = runs
      .map((r) => r.durationMs)
      .filter((d): d is number => d !== null && d > 0);
    const avgDurationMs =
      durationsMs.length > 0
        ? Math.round(
            durationsMs.reduce((a, b) => a + b, 0) / durationsMs.length,
          )
        : 0;

    // ── (5) Queue depth (pending + active in-progress statuses) ──────
    const activeStatuses = new Set([
      "pending",
      "scanning",
      "extracting",
      "generating",
    ]);
    const queueDepth = runs.filter((r) =>
      activeStatuses.has(r.status as string),
    ).length;

    // ── (6) Per-stage latency from pipeline:stage events ─────────────
    const eventConditions: SQL[] = [
      eq(agentEvents.workspaceId, ws.id),
      eq(agentEvents.eventType, "pipeline:stage"),
      gte(agentEvents.createdAt, sinceDate),
      lte(agentEvents.createdAt, untilDate),
    ];

    const stageEvents = await db
      .select({
        traceId: agentEvents.traceId,
        payload: agentEvents.payload,
        createdAt: agentEvents.createdAt,
      })
      .from(agentEvents)
      .where(and(...eventConditions));

    // Group events by traceId, compute per-stage durations
    const traceStages = new Map<
      string,
      { stage: string; timestamp: number }[]
    >();
    for (const evt of stageEvents) {
      const payload = evt.payload as Record<string, unknown> | null;
      const stage = (payload?.stage as string) ?? "unknown";
      const ts = evt.createdAt.getTime();

      if (!traceStages.has(evt.traceId)) {
        traceStages.set(evt.traceId, []);
      }
      traceStages.get(evt.traceId)!.push({ stage, timestamp: ts });
    }

    // Compute average latency per stage transition
    const stageDurations = new Map<string, number[]>();
    for (const events of traceStages.values()) {
      // Sort by timestamp ascending
      events.sort((a, b) => a.timestamp - b.timestamp);
      for (let i = 0; i < events.length - 1; i++) {
        const stageName = events[i].stage;
        const duration = events[i + 1].timestamp - events[i].timestamp;
        if (!stageDurations.has(stageName)) {
          stageDurations.set(stageName, []);
        }
        stageDurations.get(stageName)!.push(duration);
      }
    }

    const stageLatency: Record<string, { avgMs: number; count: number }> = {};
    for (const [stage, durations] of stageDurations) {
      const avg = Math.round(
        durations.reduce((a, b) => a + b, 0) / durations.length,
      );
      stageLatency[stage] = { avgMs: avg, count: durations.length };
    }

    return NextResponse.json({
      workspace: workspaceSlug,
      dateRange: {
        since: sinceDate.toISOString(),
        until: untilDate.toISOString(),
      },
      totalRuns: total,
      stateCounts,
      failureRate: Math.round(failureRate * 10000) / 10000,
      throughput: Math.round(throughput * 100) / 100,
      avgDurationMs,
      queueDepth,
      stageLatency,
    });
  } catch (error) {
    console.error(
      "[observability/metrics] Error:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
