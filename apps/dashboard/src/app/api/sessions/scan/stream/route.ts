import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { workspaces } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";
import { scanSessionFiles } from "@/lib/sessions/scanner";
import { parseSessionFile } from "@/lib/sessions/parser";
import { normalizeSession } from "@/lib/sessions/normalizer";
import { indexSessions } from "@/lib/sessions/indexer";
import { checkQuota, recordUsage } from "@/lib/billing/usage";

export const dynamic = "force-dynamic";

function sseEvent(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return new Response(sseEvent({ type: "error", message: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  const searchParams = req.nextUrl.searchParams;
  const lookbackParam = searchParams.get("lookbackDays");
  const parsedDays = lookbackParam !== null ? parseInt(lookbackParam, 10) : NaN;
  const lookbackDays = !isNaN(parsedDays) ? parsedDays : 30;
  const workspaceSlug = searchParams.get("workspaceSlug");

  const workspace = workspaceSlug
    ? await db
        .select()
        .from(workspaces)
        .where(eq(workspaces.slug, workspaceSlug))
        .limit(1)
    : await db
        .select()
        .from(workspaces)
        .where(eq(workspaces.ownerId, session.user.id))
        .limit(1);

  if (!workspace.length) {
    return new Response(
      sseEvent({ type: "error", message: "No workspace found" }),
      {
        status: 404,
        headers: { "Content-Type": "text/event-stream" },
      }
    );
  }

  const ws = workspace[0];

  const quotaCheck = await checkQuota(session.user.id, "session_scan");
  if (!quotaCheck.allowed) {
    return new Response(
      sseEvent({ type: "error", message: "Quota exceeded. Upgrade your plan to continue scanning." }),
      {
        status: 402,
        headers: { "Content-Type": "text/event-stream" },
      }
    );
  }

  const userId = session.user.id;
  const basePath = ws.sessionBasePath ?? "~/.claude";
  const start = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (data: unknown) => {
        controller.enqueue(new TextEncoder().encode(sseEvent(data)));
      };

      try {
        const files = await scanSessionFiles(lookbackDays, basePath);
        const total = files.length;

        enqueue({ type: "start", total });

        const normalized = [];
        for (let i = 0; i < files.length; i++) {
          const meta = files[i];
          enqueue({
            type: "progress",
            current: i + 1,
            total,
            sessionId: meta.sessionId,
            projectPath: meta.projectPath,
          });
          const parsed = await parseSessionFile(meta.filePath);
          normalized.push(await normalizeSession(meta, parsed));
        }

        const result = await indexSessions(ws.id, normalized);

        // Record usage for newly indexed sessions
        if (result.new > 0) {
          void Promise.all(
            Array.from({ length: result.new }, () =>
              recordUsage(userId, ws.id, "session_scan")
            )
          );
        }

        // Update workspace lastScanAt
        await db
          .update(workspaces)
          .set({ lastScanAt: new Date() })
          .where(eq(workspaces.id, ws.id));

        enqueue({
          type: "complete",
          scanned: result.scanned,
          new: result.new,
          updated: result.updated,
          errors: result.errors,
          durationMs: Date.now() - start,
        });
      } catch (err) {
        enqueue({
          type: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
