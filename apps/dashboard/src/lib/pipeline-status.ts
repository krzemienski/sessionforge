export type RunStatus =
  | "pending"
  | "scanning"
  | "extracting"
  | "generating"
  | "complete"
  | "failed"
  | null;

export interface PipelineRun {
  id?: string;
  status: string;
  sessionsScanned: number | null;
  insightsExtracted: number | null;
  postId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  triggerName: string | null;
}

export const ACTIVE_STATUSES: string[] = [
  "pending",
  "scanning",
  "extracting",
  "generating",
];

export function statusBadgeClass(status: string) {
  const base = "px-2 py-0.5 rounded-sf-full text-xs font-medium";
  switch (status) {
    case "complete":
      return `${base} bg-green-500/15 text-green-500`;
    case "failed":
      return `${base} bg-red-500/15 text-red-500`;
    case "scanning":
    case "extracting":
    case "generating":
      return `${base} bg-sf-accent/15 text-sf-accent`;
    case "pending":
      return `${base} bg-yellow-500/15 text-yellow-500`;
    default:
      return `${base} bg-sf-bg-tertiary text-sf-text-muted`;
  }
}

export function statusLabel(status: string) {
  switch (status) {
    case "scanning":
      return "Scanning";
    case "extracting":
      return "Extracting";
    case "generating":
      return "Generating";
    case "complete":
      return "Complete";
    case "failed":
      return "Failed";
    case "pending":
      return "Queued";
    default:
      return status;
  }
}
