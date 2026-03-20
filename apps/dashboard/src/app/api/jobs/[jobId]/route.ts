import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { batchJobs } from "@sessionforge/db";
import { eq } from "drizzle-orm";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getAuthorizedWorkspaceById } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const job = await db.query.batchJobs.findFirst({
      where: eq(batchJobs.id, jobId),
    });

    if (!job) {
      throw new AppError("Job not found", ERROR_CODES.NOT_FOUND);
    }

    await getAuthorizedWorkspaceById(session, job.workspaceId, PERMISSIONS.CONTENT_READ);

    return NextResponse.json(job);
  })(_req);
}
