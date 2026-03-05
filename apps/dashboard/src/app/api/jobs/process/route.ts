import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/queue/job-tracker";
import {
  processExtractInsights,
  processGenerateContent,
  processPostBatch,
} from "@/lib/queue/batch-processor";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const jobId: string | undefined =
    typeof body.jobId === "string" ? body.jobId : undefined;

  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  const job = await getJob(jobId);

  // Return 200 if job not found or already in a terminal/active state
  if (!job || job.status !== "pending") {
    return NextResponse.json({ jobId, skipped: true });
  }

  const metadata = (job.metadata ?? {}) as Record<string, unknown>;

  // Dispatch to the appropriate processor based on job type
  switch (job.type) {
    case "extract_insights": {
      const sessionIds = Array.isArray(metadata.sessionIds)
        ? (metadata.sessionIds as string[])
        : [];
      processExtractInsights(jobId, job.workspaceId, job.createdBy ?? "", sessionIds).catch(
        () => undefined
      );
      break;
    }
    case "generate_content": {
      const insightIds = Array.isArray(metadata.insightIds)
        ? (metadata.insightIds as string[])
        : [];
      const contentType =
        typeof metadata.contentType === "string"
          ? metadata.contentType
          : undefined;
      processGenerateContent(
        jobId,
        job.workspaceId,
        job.createdBy ?? "",
        insightIds,
        contentType
      ).catch(() => undefined);
      break;
    }
    case "batch_archive":
    case "batch_delete": {
      const postIds = Array.isArray(metadata.postIds)
        ? (metadata.postIds as string[])
        : [];
      const operation =
        typeof metadata.operation === "string" &&
        ["archive", "delete", "publish", "unpublish"].includes(
          metadata.operation
        )
          ? (metadata.operation as "archive" | "delete" | "publish" | "unpublish")
          : job.type === "batch_delete"
          ? "delete"
          : "archive";
      processPostBatch(jobId, job.workspaceId, postIds, operation).catch(
        () => undefined
      );
      break;
    }
    default:
      return NextResponse.json(
        { error: "Unknown job type" },
        { status: 400 }
      );
  }

  return NextResponse.json({ jobId, status: "processing" });
}
