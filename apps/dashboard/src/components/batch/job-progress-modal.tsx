"use client";

import { useEffect } from "react";
import { X, CheckCircle, XCircle, Clock, RefreshCw } from "lucide-react";
import { useJobProgress, type JobStatus } from "@/hooks/use-job-progress";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface JobProgressModalProps {
  jobId: string | null;
  title?: string;
  isOpen: boolean;
  onClose: () => void;
}

function useCancelJob() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (jobId: string) => {
      const res = await fetch(`/api/jobs/${jobId}/cancel`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to cancel job");
    },
    onSuccess: (_data, jobId) => {
      qc.invalidateQueries({ queryKey: ["job-progress", jobId] });
    },
  });
}

function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

function statusLabel(status: JobStatus): string {
  switch (status) {
    case "pending":
      return "Waiting to start...";
    case "processing":
      return "Processing...";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

export function JobProgressModal({
  jobId,
  title = "Batch Operation",
  isOpen,
  onClose,
}: JobProgressModalProps) {
  const { data: job, isLoading } = useJobProgress(jobId);
  const cancelJob = useCancelJob();

  const isTerminal =
    job?.status === "completed" ||
    job?.status === "failed" ||
    job?.status === "cancelled";

  // Auto-close after a short delay when completed successfully
  useEffect(() => {
    if (job?.status === "completed") {
      const timer = setTimeout(() => onClose(), 3000);
      return () => clearTimeout(timer);
    }
  }, [job?.status, onClose]);

  if (!isOpen) return null;

  const isActive =
    job?.status === "pending" || job?.status === "processing";

  async function handleCancel() {
    if (!jobId) return;
    await cancelJob.mutateAsync(jobId);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={isTerminal ? onClose : undefined}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-md bg-sf-bg-secondary border border-sf-border rounded-sf-lg shadow-xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold font-display text-sf-text-primary">
            {title}
          </h2>
          {isTerminal && (
            <button
              onClick={onClose}
              className="text-sf-text-secondary hover:text-sf-text-primary transition-colors"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {isLoading && !job ? (
          <div className="flex items-center gap-2 text-sm text-sf-text-secondary py-4">
            <RefreshCw size={14} className="animate-spin" />
            <span>Loading job status...</span>
          </div>
        ) : job ? (
          <div className="space-y-4">
            {/* Status row */}
            <div className="flex items-center gap-2">
              {job.status === "completed" ? (
                <CheckCircle size={16} className="text-sf-success flex-shrink-0" />
              ) : job.status === "failed" || job.status === "cancelled" ? (
                <XCircle size={16} className="text-sf-error flex-shrink-0" />
              ) : (
                <RefreshCw size={16} className="animate-spin text-sf-accent flex-shrink-0" />
              )}
              <span
                className={`text-sm font-medium ${
                  job.status === "completed"
                    ? "text-sf-success"
                    : job.status === "failed" || job.status === "cancelled"
                    ? "text-sf-error"
                    : "text-sf-text-primary"
                }`}
              >
                {statusLabel(job.status)}
              </span>
            </div>

            {/* Progress bar */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-sf-text-secondary">
                  {job.processedItems} / {job.totalItems} items
                </span>
                <span className="text-sm font-medium text-sf-text-primary">
                  {job.progressPercent}%
                </span>
              </div>
              <div className="w-full h-2 bg-sf-bg-tertiary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    job.status === "completed"
                      ? "bg-sf-success"
                      : job.status === "failed" || job.status === "cancelled"
                      ? "bg-sf-error"
                      : "bg-sf-accent"
                  }`}
                  style={{ width: `${job.progressPercent}%` }}
                />
              </div>
            </div>

            {/* Success / error counts */}
            {(job.processedItems > 0 || isTerminal) && (
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5 text-sf-success">
                  <CheckCircle size={13} />
                  <span>{job.successItems} succeeded</span>
                </div>
                {job.failedItems > 0 && (
                  <div className="flex items-center gap-1.5 text-sf-error">
                    <XCircle size={13} />
                    <span>{job.failedItems} failed</span>
                  </div>
                )}
              </div>
            )}

            {/* ETA */}
            {isActive &&
              job.estimatedSecondsRemaining !== null &&
              job.estimatedSecondsRemaining > 0 && (
                <div className="flex items-center gap-1.5 text-sm text-sf-text-secondary">
                  <Clock size={13} className="flex-shrink-0" />
                  <span>
                    ~{formatSeconds(job.estimatedSecondsRemaining)} remaining
                  </span>
                </div>
              )}

            {/* Error message */}
            {job.errorMessage && (
              <p className="text-sm text-sf-error">{job.errorMessage}</p>
            )}

            {/* Auto-close notice */}
            {job.status === "completed" && (
              <p className="text-xs text-sf-text-tertiary">
                This dialog will close automatically in a moment.
              </p>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-1">
              {isActive && (
                <button
                  onClick={handleCancel}
                  disabled={cancelJob.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-sf text-sm font-medium text-sf-text-secondary hover:text-sf-text-primary hover:bg-sf-bg-hover border border-sf-border transition-colors disabled:opacity-50"
                >
                  {cancelJob.isPending ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : null}
                  Cancel Operation
                </button>
              )}
              {isTerminal && (
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-sf bg-sf-accent text-sf-bg-primary text-sm font-medium hover:bg-sf-accent-dim transition-colors"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-sf-text-secondary py-4">
            Job not found.
          </p>
        )}
      </div>
    </div>
  );
}
