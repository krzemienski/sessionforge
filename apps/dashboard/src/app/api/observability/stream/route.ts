/**
 * GET /api/observability/stream
 *
 * SSE endpoint for real-time observability events.
 * Query params: workspaceSlug (required), traceId (optional), agentType (optional)
 */

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { sseBroadcaster } from "@/lib/observability/sse-broadcaster";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const workspaceSlug = params.get("workspaceSlug");
  if (!workspaceSlug) {
    return new Response("workspaceSlug required", { status: 400 });
  }

  const { workspace: ws } = await getAuthorizedWorkspace(
    session,
    workspaceSlug,
    PERMISSIONS.ANALYTICS_READ
  );

  const traceId = params.get("traceId") ?? undefined;
  const agentType = params.get("agentType") ?? undefined;

  const stream = new ReadableStream({
    start(controller) {
      const conn = sseBroadcaster.addConnection(ws.id, controller, {
        traceId,
        agentType,
      });

      // Clean up on client disconnect
      req.signal.addEventListener("abort", () => {
        sseBroadcaster.removeConnection(conn);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
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
