/**
 * Shared types for the activity feed.
 * Imported by both the /api/activity route and the dashboard/activity-log
 * component — keeping it here avoids a component→route import cycle (H12).
 */

export type ActivityEvent = {
  id: string;
  type:
    | "pipeline_complete"
    | "pipeline_failed"
    | "pipeline_running"
    | "agent_complete"
    | "agent_failed"
    | "agent_running";
  title: string;
  description: string;
  timestamp: string;
  metadata: Record<string, unknown>;
};
