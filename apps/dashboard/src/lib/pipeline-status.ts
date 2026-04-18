/** Union of all possible run status values. */
export type RunStatus =
  | "pending"
  | "scanning"
  | "extracting"
  | "generating"
  | "complete"
  | "failed"
  | null;

/** In-flight representation of a pipeline run. */
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

/** List of statuses indicating an active/in-progress pipeline run. */
export const ACTIVE_STATUSES: string[] = [
  "pending",
  "scanning",
  "extracting",
  "generating",
];

/**
 * Returns Tailwind CSS classes for styling a pipeline run status badge.
 * @param status - Run status value.
 * @returns CSS class string for the badge.
 */
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

/**
 * Returns a human-readable label for a pipeline run status.
 * @param status - Run status value.
 * @returns Display label for the UI.
 */
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

// --- Metrics types ---

/** Performance metrics for a pipeline stage. */
export interface StageLatency {
  avgMs: number;
  count: number;
}

/** Daily pipeline throughput and failure statistics. */
export interface DailyThroughput {
  date: string;
  runs: number;
  failures: number;
}

/** Aggregate pipeline metrics for a workspace and time range. */
export interface PipelineMetrics {
  workspace: string;
  dateRange: { since: string; until: string };
  totalRuns: number;
  stateCounts: Record<string, number>;
  failureRate: number;
  throughput: number;
  avgDurationMs: number;
  queueDepth: number;
  stageLatency: Record<string, StageLatency>;
  dailyThroughput?: DailyThroughput[];
}

// --- Run detail types ---

/** Complete details of a single pipeline run including events and agent executions. */
export interface RunDetail {
  run: {
    id: string;
    triggerId: string | null;
    workspaceId: string;
    source: string;
    status: string;
    sessionsScanned: number;
    insightsExtracted: number;
    postId: string | null;
    errorMessage: string | null;
    startedAt: string;
    completedAt: string | null;
    durationMs: number | null;
    triggerName: string | null;
    triggerType: string | null;
  };
  events: Array<{
    id: string;
    agentType: string;
    eventType: string;
    level: string;
    message: string;
    createdAt: string;
    [key: string]: unknown;
  }>;
  agentRuns: Array<{
    id: string;
    agentType: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    durationMs: number | null;
    [key: string]: unknown;
  }>;
  publishStatus: {
    postId: string;
    title: string;
    status: string;
    contentType: string;
    publishedAt: string | null;
    createdAt: string | null;
  } | null;
}

// --- Helper functions ---

/**
 * Formats a duration in milliseconds into a human-readable string.
 * @param ms - Duration in milliseconds.
 * @returns Formatted string (e.g., "500ms", "2.5s", "5m 30s").
 */
export function formatLatency(ms: number): string {
  if (ms < 1_000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1_000);
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

/**
 * Converts a timeframe string into ISO date range.
 * @param timeframe - Timeframe code (e.g., "1d", "7d", "30d", "90d").
 * @returns Date range object with since and until ISO strings.
 */
export function dateRangeFromTimeframe(timeframe: string): {
  since: string;
  until: string;
} {
  const now = new Date();
  const until = now.toISOString();

  let daysBack = 7;
  switch (timeframe) {
    case "1d":
      daysBack = 1;
      break;
    case "7d":
      daysBack = 7;
      break;
    case "14d":
      daysBack = 14;
      break;
    case "30d":
      daysBack = 30;
      break;
    case "90d":
      daysBack = 90;
      break;
    default:
      daysBack = 7;
  }

  const since = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1_000);
  return { since: since.toISOString(), until };
}
