import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { batchJobs } from "@sessionforge/db";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const VALID_OPERATIONS = ["generate_content"] as const;
type BatchOperation = (typeof VALID_OPERATIONS)[number];

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { operation, insightIds, contentType, workspaceSlug } = body;

  if (!operation || !insightIds || !workspaceSlug) {
    return NextResponse.json(
      { error: "operation, insightIds, and workspaceSlug are required" },
      { status: 400 }
    );
  }

  if (!VALID_OPERATIONS.includes(operation as BatchOperation)) {
    return NextResponse.json(
      { error: `Invalid operation. Valid operations: ${VALID_OPERATIONS.join(", ")}` },
      { status: 400 }
    );
  }

  if (!Array.isArray(insightIds) || insightIds.length === 0) {
    return NextResponse.json(
      { error: "insightIds must be a non-empty array" },
      { status: 400 }
    );
  }

  const { workspace } = await getAuthorizedWorkspace(
    session,
    workspaceSlug,
    PERMISSIONS.INSIGHTS_EXTRACT
  );

  const [job] = await db
    .insert(batchJobs)
    .values({
      workspaceId: workspace.id,
      type: "generate_content",
      status: "pending",
      totalItems: insightIds.length,
      processedItems: 0,
      successCount: 0,
      errorCount: 0,
      metadata: { insightIds, contentType: contentType ?? null },
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

  return NextResponse.json(
    { jobId: job.id, status: "pending", totalItems: insightIds.length },
    { status: 202 }
  );
}
