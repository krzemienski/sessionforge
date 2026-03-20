// ── Publish Gate ───────────────────────────────────────────────────────────
// Determines whether a post can be published based on its unresolved risk
// flags. Critical-severity flags block publishing unless overridden by an
// authorized workspace role.
//
// Follow the pattern from RiskScorer in lib/verification/risk-scorer.ts.

import type { RiskFlag, FlagStatus } from "./types";

// ── Types ──────────────────────────────────────────────────────────────────

/** Workspace roles that determine override permissions. */
export type WorkspaceRole = "owner" | "editor" | "viewer";

/** Result of the publish eligibility check. */
export interface PublishGateResult {
  /** Whether the post can be published without an override. */
  allowed: boolean;
  /** Critical-severity flags that are still unresolved and blocking publish. */
  blockingFlags: RiskFlag[];
  /** Whether an override is available (i.e. blocking flags exist but could be overridden). */
  requiresOverride: boolean;
}

/** Result of checking override permissions for a workspace role. */
export interface OverridePolicy {
  /** Whether the role is allowed to override critical flags. */
  canOverride: boolean;
  /** Optional warning message to show before the override is applied. */
  warning?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

/** Flag statuses that count as "resolved" and no longer block publish. */
const RESOLVED_STATUSES: FlagStatus[] = ["verified", "dismissed", "overridden"];

// ── Publish Gate Functions ─────────────────────────────────────────────────

/**
 * Check whether a post can be published based on its risk flags.
 *
 * A post is blocked from publishing if it has any `critical`-severity flags
 * that are still unresolved. Lower-severity flags (high, medium, low, info)
 * do not block publishing — they are advisory only.
 *
 * @param flags - All risk flags for the post
 * @returns Publish eligibility result with blocking flags and override status
 *
 * @example
 * ```ts
 * const result = canPublish(flags);
 * if (!result.allowed && result.requiresOverride) {
 *   // Show override prompt to the user
 * }
 * ```
 */
export function canPublish(flags: RiskFlag[]): PublishGateResult {
  const blockingFlags = flags.filter(
    (flag) =>
      flag.severity === "critical" &&
      !RESOLVED_STATUSES.includes(flag.status)
  );

  const allowed = blockingFlags.length === 0;

  return {
    allowed,
    blockingFlags,
    requiresOverride: !allowed,
  };
}

/**
 * Get the override policy for a workspace role.
 *
 * Determines whether the given role is permitted to override critical risk
 * flags that would otherwise block publishing.
 *
 * - **owner**: can override with no restrictions.
 * - **editor**: can override but receives a warning about the risk.
 * - **viewer**: cannot override; must escalate to an owner or editor.
 *
 * @param workspaceRole - The user's role in the workspace
 * @returns Override policy including permission and optional warning
 *
 * @example
 * ```ts
 * const policy = getOverridePolicy("editor");
 * if (policy.canOverride) {
 *   // Allow override, but show policy.warning if present
 * }
 * ```
 */
export function getOverridePolicy(workspaceRole: WorkspaceRole): OverridePolicy {
  switch (workspaceRole) {
    case "owner":
      return { canOverride: true };

    case "editor":
      return {
        canOverride: true,
        warning:
          "You are overriding critical verification flags. This post contains unverified claims that may affect credibility.",
      };

    case "viewer":
      return { canOverride: false };
  }
}
