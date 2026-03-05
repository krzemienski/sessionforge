import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { batchJobs, workspaces } from "@sessionforge/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const VALID_OPERATIONS = ["extract_insights"] as const;
type BatchOperation = (typeof VALID_OPERATIONS)[number];

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { operation, sessionIds, workspaceSlug } = body;

  if (!operation || !sessionIds || !workspaceSlug) {
    return NextResponse.json(
      { error: "operation, sessionIds, and workspaceSlug are required" },
      { status: 400 }
    );
  }

  if (!VALID_OPERATIONS.includes(operation as BatchOperation)) {
    return NextResponse.json(
      { error: `Invalid operation. Valid operations: ${VALID_OPERATIONS.join(", ")}` },
      { status: 400 }
    );
  }

  if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
    return NextResponse.json(
      { error: "sessionIds must be a non-empty array" },
      { status: 400 }
    );
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, workspaceSlug),
  });

  if (!workspace || workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const [job] = await db
    .insert(batchJobs)
    .values({
      workspaceId: workspace.id,
      type: "extract_insights",
      status: "pending",
      totalItems: sessionIds.length,
      processedItems: 0,
      successCount: 0,
      errorCount: 0,
      metadata: { sessionIds },
      createdBy: session.user.id,
    })
    .returning({ id: batchJobs.id });

  // Enqueue job for background processing
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    await fetch(`${appUrl}/api/jobs/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: job.id }),
    });
  } catch {
    // Non-blocking: job is created and can be retried
  }

  return NextResponse.json({ jobId: job.id, status: "pending", totalItems: sessionIds.length }, { status: 202 });
}
