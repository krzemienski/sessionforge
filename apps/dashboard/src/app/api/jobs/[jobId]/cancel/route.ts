import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { batchJobs, workspaces } from "@sessionforge/db";
import { eq, and } from "drizzle-orm";
import { cancelJob } from "@/lib/queue/job-tracker";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId } = await params;

  const workspace = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.ownerId, session.user.id))
    .limit(1);

  if (!workspace.length) {
    return NextResponse.json({ error: "No workspace found" }, { status: 404 });
  }

  const rows = await db
    .select()
    .from(batchJobs)
    .where(
      and(
        eq(batchJobs.workspaceId, workspace[0].id),
        eq(batchJobs.id, jobId)
      )
    )
    .limit(1);

  if (!rows.length) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const job = rows[0];

  if (job.status !== "pending" && job.status !== "processing") {
    return NextResponse.json(
      { error: "Job is already in a terminal state" },
      { status: 409 }
    );
  }

  await cancelJob(jobId);

  return NextResponse.json({ jobId, status: "cancelled" });
}
