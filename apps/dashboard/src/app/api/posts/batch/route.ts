import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { batchJobs } from "@sessionforge/db";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const VALID_OPERATIONS = ["archive", "delete", "publish", "unpublish"] as const;
type BatchOperation = (typeof VALID_OPERATIONS)[number];

export async function POST(request: Request) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const body = await request.json();
    const { operation, postIds, workspaceSlug } = body;

    if (!operation || !postIds || !workspaceSlug) {
      throw new AppError(
        "operation, postIds, and workspaceSlug are required",
        ERROR_CODES.BAD_REQUEST
      );
    }

    if (!VALID_OPERATIONS.includes(operation as BatchOperation)) {
      throw new AppError(
        `Invalid operation. Valid operations: ${VALID_OPERATIONS.join(", ")}`,
        ERROR_CODES.BAD_REQUEST
      );
    }

    if (!Array.isArray(postIds) || postIds.length === 0) {
      throw new AppError(
        "postIds must be a non-empty array",
        ERROR_CODES.BAD_REQUEST
      );
    }

    // Use content:delete for delete operations, content:edit for others
    const requiredPermission = operation === "delete"
      ? PERMISSIONS.CONTENT_DELETE
      : operation === "publish" || operation === "unpublish"
        ? PERMISSIONS.PUBLISHING_PUBLISH
        : PERMISSIONS.CONTENT_EDIT;

    const { workspace } = await getAuthorizedWorkspace(
      session,
      workspaceSlug,
      requiredPermission
    );

    const jobType = operation === "delete" ? "batch_delete" : "batch_archive";

    const [job] = await db
      .insert(batchJobs)
      .values({
        workspaceId: workspace.id,
        type: jobType,
        status: "pending",
        totalItems: postIds.length,
        processedItems: 0,
        successCount: 0,
        errorCount: 0,
        metadata: { postIds, operation },
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
      { jobId: job.id, status: "pending", totalItems: postIds.length },
      { status: 202 }
    );
  })(request);
}
