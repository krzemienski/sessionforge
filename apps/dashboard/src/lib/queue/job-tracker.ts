import { db } from "@/lib/db";
import { batchJobs } from "@sessionforge/db";
import { eq } from "drizzle-orm";
import type { batchJobTypeEnum } from "@sessionforge/db";

type BatchJobType = (typeof batchJobTypeEnum.enumValues)[number];

export interface CreateJobOptions {
  workspaceId: string;
  type: BatchJobType;
  totalItems: number;
  createdBy?: string;
  metadata?: Record<string, unknown>;
}

export interface JobProgressUpdate {
  processedItems: number;
  successCount: number;
  errorCount: number;
}

export async function createJob(options: CreateJobOptions): Promise<string> {
  const { workspaceId, type, totalItems, createdBy, metadata } = options;

  const [job] = await db
    .insert(batchJobs)
    .values({
      workspaceId,
      type,
      totalItems,
      status: "pending",
      processedItems: 0,
      successCount: 0,
      errorCount: 0,
      createdBy: createdBy ?? null,
      metadata: metadata ?? null,
    })
    .returning({ id: batchJobs.id });

  return job.id;
}

export async function updateJobProgress(
  jobId: string,
  progress: JobProgressUpdate
): Promise<void> {
  await db
    .update(batchJobs)
    .set({
      processedItems: progress.processedItems,
      successCount: progress.successCount,
      errorCount: progress.errorCount,
      status: "processing",
    })
    .where(eq(batchJobs.id, jobId));
}

export async function completeJob(
  jobId: string,
  finalProgress: JobProgressUpdate
): Promise<void> {
  await db
    .update(batchJobs)
    .set({
      processedItems: finalProgress.processedItems,
      successCount: finalProgress.successCount,
      errorCount: finalProgress.errorCount,
      status: "completed",
      completedAt: new Date(),
    })
    .where(eq(batchJobs.id, jobId));
}

export async function failJob(jobId: string, error?: string): Promise<void> {
  const existing = await getJob(jobId);
  const metadata = error
    ? { ...(existing?.metadata as Record<string, unknown> | null ?? {}), error }
    : (existing?.metadata ?? null);

  await db
    .update(batchJobs)
    .set({
      status: "failed",
      completedAt: new Date(),
      metadata,
    })
    .where(eq(batchJobs.id, jobId));
}

export async function cancelJob(jobId: string): Promise<void> {
  await db
    .update(batchJobs)
    .set({
      status: "cancelled",
      completedAt: new Date(),
    })
    .where(eq(batchJobs.id, jobId));
}

export async function getJob(jobId: string) {
  const [job] = await db
    .select()
    .from(batchJobs)
    .where(eq(batchJobs.id, jobId))
    .limit(1);

  return job ?? null;
}
