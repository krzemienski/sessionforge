/**
 * POST /api/content/mine-sessions
 *
 * Mines Claude session history for evidence related to a topic.
 * Streams progress and results via Server-Sent Events.
 *
 * Body: { workspaceSlug: string, topic: string, limit?: number }
 *
 * SSE events: indexing | searching | classifying | results | done
 */

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { z } from "zod";
import { createSSEStream, sseResponse } from "@/lib/ai/orchestration/streaming";
import { SessionMiner } from "@/lib/sessions/miner";
import { classifyEvidence } from "@/lib/sessions/evidence-classifier";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const mineSessionsSchema = z.object({
  workspaceSlug: z.string().min(1, "workspaceSlug is required"),
  topic: z.string().min(1, "topic is required").max(500),
  limit: z.number().int().positive().max(50).optional().default(20),
});

export async function POST(req: Request) {
  const { stream, send, close } = createSSEStream();

  const run = async () => {
    try {
      // Auth check
      const session = await auth.api.getSession({ headers: await headers() });
      if (!session) {
        send("error", { message: "Unauthorized" });
        close();
        return;
      }

      // Parse and validate body
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        send("error", { message: "Invalid JSON body" });
        close();
        return;
      }

      const parsed = mineSessionsSchema.safeParse(body);
      if (!parsed.success) {
        const fields = parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        }));
        send("error", { message: "Validation failed", fields });
        close();
        return;
      }

      const { workspaceSlug, topic, limit } = parsed.data;

      // Resolve workspace
      let workspaceId: string;
      try {
        const { workspace } = await getAuthorizedWorkspace(
          session,
          workspaceSlug,
          PERMISSIONS.CONTENT_READ
        );
        workspaceId = workspace.id;
      } catch {
        send("error", { message: "Workspace not found" });
        close();
        return;
      }

      const miner = new SessionMiner(workspaceId);

      // Phase 1: Index
      send("indexing", { message: "Building session index…" });

      await miner.buildIndex((indexed, total) => {
        send("indexing", {
          message: `Indexing sessions… ${indexed}/${total}`,
          indexed,
          total,
        });
      });

      const status = await miner.getIndexStatus();
      send("indexing", {
        message: "Index ready",
        totalSessions: status.totalSessions,
        totalDocuments: status.totalDocuments,
      });

      // Phase 2: Search
      send("searching", { message: `Searching for "${topic}"…` });

      const hits = await miner.search(topic, limit);

      send("searching", {
        message: `Found ${hits.length} relevant passages`,
        hitCount: hits.length,
      });

      if (hits.length === 0) {
        send("results", { evidence: [], message: "No matching evidence found" });
        close();
        return;
      }

      // Phase 3: Classify
      send("classifying", {
        message: `Classifying ${hits.length} evidence items…`,
        count: hits.length,
      });

      const evidence = await classifyEvidence(hits, topic);

      // Sort by relevance descending
      evidence.sort((a, b) => b.relevanceScore - a.relevanceScore);

      // Phase 4: Results
      send("results", {
        evidence,
        topic,
        totalFound: evidence.length,
        message: `Mining complete — ${evidence.length} evidence items found`,
      });

      close();
    } catch (err) {
      const message =
        err instanceof AppError
          ? err.message
          : err instanceof Error
          ? err.message
          : "Mining failed";
      send("error", { message });
      close();
    }
  };

  run();
  return sseResponse(stream);
}
