import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  devtoIntegrations,
  ghostIntegrations,
  mediumIntegrations,
  twitterIntegrations,
  linkedinIntegrations,
  wordpressConnections,
  integrationHealthChecks,
} from "@sessionforge/db";
import { verifyDevtoApiKey } from "./devto";
import { verifyGhostApiKey } from "./ghost";
import { verifyMediumToken } from "./medium";
import { verifyTwitterAuth } from "./twitter";
import { verifyLinkedInAuth } from "./linkedin";
import { decryptAppPassword } from "@/lib/wordpress/crypto";
import { eventBus } from "@/lib/observability/event-bus";
import { createAgentEvent } from "@/lib/observability/event-types";

// ── Types ──

export type IntegrationPlatform =
  | "devto"
  | "ghost"
  | "medium"
  | "twitter"
  | "linkedin"
  | "wordpress";

export type HealthStatus = "healthy" | "degraded" | "unhealthy" | "auth_expired";

export interface HealthCheckResult {
  platform: IntegrationPlatform;
  status: HealthStatus;
  responseTimeMs: number;
  errorMessage?: string;
  errorCode?: string;
}

// ── Constants ──

const DEGRADED_THRESHOLD_MS = 3000;

// ── Single-platform health check ──

function classifyHealthStatus(
  responseTimeMs: number,
  error?: { status?: number; message?: string }
): { status: HealthStatus; errorMessage?: string; errorCode?: string } {
  if (!error) {
    if (responseTimeMs > DEGRADED_THRESHOLD_MS) {
      return { status: "degraded" };
    }
    return { status: "healthy" };
  }

  if (error.status === 401 || error.status === 403) {
    return {
      status: "auth_expired",
      errorMessage: error.message,
      errorCode: String(error.status),
    };
  }

  return {
    status: "unhealthy",
    errorMessage: error.message,
    errorCode: error.status ? String(error.status) : "unknown",
  };
}

async function timedVerify(
  verifyFn: () => Promise<unknown>
): Promise<{ responseTimeMs: number; error?: { status?: number; message?: string } }> {
  const start = Date.now();
  try {
    await verifyFn();
    return { responseTimeMs: Date.now() - start };
  } catch (err: unknown) {
    const responseTimeMs = Date.now() - start;
    const status =
      err && typeof err === "object" && "status" in err
        ? (err as { status: number }).status
        : undefined;
    const message = err instanceof Error ? err.message : "Unknown error";
    return { responseTimeMs, error: { status, message } };
  }
}

export async function checkDevtoHealth(apiKey: string): Promise<HealthCheckResult> {
  const { responseTimeMs, error } = await timedVerify(() => verifyDevtoApiKey(apiKey));
  const { status, errorMessage, errorCode } = classifyHealthStatus(responseTimeMs, error);
  return { platform: "devto", status, responseTimeMs, errorMessage, errorCode };
}

export async function checkGhostHealth(
  adminApiKey: string,
  ghostUrl: string
): Promise<HealthCheckResult> {
  const { responseTimeMs, error } = await timedVerify(() =>
    verifyGhostApiKey(adminApiKey, ghostUrl)
  );
  const { status, errorMessage, errorCode } = classifyHealthStatus(responseTimeMs, error);
  return { platform: "ghost", status, responseTimeMs, errorMessage, errorCode };
}

export async function checkMediumHealth(accessToken: string): Promise<HealthCheckResult> {
  const { responseTimeMs, error } = await timedVerify(() => verifyMediumToken(accessToken));
  const { status, errorMessage, errorCode } = classifyHealthStatus(responseTimeMs, error);
  return { platform: "medium", status, responseTimeMs, errorMessage, errorCode };
}

export async function checkTwitterHealth(accessToken: string): Promise<HealthCheckResult> {
  const { responseTimeMs, error } = await timedVerify(() => verifyTwitterAuth(accessToken));
  const { status, errorMessage, errorCode } = classifyHealthStatus(responseTimeMs, error);
  return { platform: "twitter", status, responseTimeMs, errorMessage, errorCode };
}

export async function checkLinkedInHealth(accessToken: string): Promise<HealthCheckResult> {
  const { responseTimeMs, error } = await timedVerify(() => verifyLinkedInAuth(accessToken));
  const { status, errorMessage, errorCode } = classifyHealthStatus(responseTimeMs, error);
  return { platform: "linkedin", status, responseTimeMs, errorMessage, errorCode };
}

export async function checkWordPressHealth(
  siteUrl: string,
  username: string,
  appPassword: string
): Promise<HealthCheckResult> {
  const normalizedUrl = siteUrl.replace(/\/+$/, "");
  const { responseTimeMs, error } = await timedVerify(async () => {
    const response = await fetch(`${normalizedUrl}/wp-json/wp/v2/users/me`, {
      headers: {
        Authorization: `Basic ${btoa(`${username}:${appPassword}`)}`,
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) {
      throw Object.assign(new Error(`WordPress API error (${response.status})`), {
        status: response.status,
      });
    }
  });
  const { status, errorMessage, errorCode } = classifyHealthStatus(responseTimeMs, error);
  return { platform: "wordpress", status, responseTimeMs, errorMessage, errorCode };
}

// ── Check all integrations for a workspace ──

export async function checkAllIntegrations(
  workspaceId: string
): Promise<HealthCheckResult[]> {
  const results: HealthCheckResult[] = [];

  const [devto, ghost, medium, twitter, linkedin, wordpress] = await Promise.all([
    db
      .select()
      .from(devtoIntegrations)
      .where(eq(devtoIntegrations.workspaceId, workspaceId))
      .then((rows) => rows[0] ?? null),
    db
      .select()
      .from(ghostIntegrations)
      .where(eq(ghostIntegrations.workspaceId, workspaceId))
      .then((rows) => rows[0] ?? null),
    db
      .select()
      .from(mediumIntegrations)
      .where(eq(mediumIntegrations.workspaceId, workspaceId))
      .then((rows) => rows[0] ?? null),
    db
      .select()
      .from(twitterIntegrations)
      .where(eq(twitterIntegrations.workspaceId, workspaceId))
      .then((rows) => rows[0] ?? null),
    db
      .select()
      .from(linkedinIntegrations)
      .where(eq(linkedinIntegrations.workspaceId, workspaceId))
      .then((rows) => rows[0] ?? null),
    db
      .select()
      .from(wordpressConnections)
      .where(eq(wordpressConnections.workspaceId, workspaceId))
      .then((rows) => rows[0] ?? null),
  ]);

  const checks: Promise<HealthCheckResult>[] = [];

  if (devto?.enabled) {
    checks.push(checkDevtoHealth(devto.apiKey));
  }

  if (ghost?.enabled) {
    checks.push(checkGhostHealth(ghost.adminApiKey, ghost.ghostUrl));
  }

  if (medium?.enabled) {
    checks.push(checkMediumHealth(medium.apiKey));
  }

  if (twitter?.enabled) {
    checks.push(checkTwitterHealth(twitter.accessToken));
  }

  if (linkedin?.enabled) {
    checks.push(checkLinkedInHealth(linkedin.accessToken));
  }

  if (wordpress?.isActive) {
    try {
      const appPassword = decryptAppPassword(wordpress.encryptedAppPassword);
      checks.push(
        checkWordPressHealth(
          wordpress.siteUrl,
          wordpress.username,
          appPassword
        )
      );
    } catch {
      results.push({
        platform: "wordpress",
        status: "unhealthy",
        responseTimeMs: 0,
        errorMessage: "Failed to decrypt stored credentials",
        errorCode: "decrypt_error",
      });
    }
  }

  const settled = await Promise.allSettled(checks);
  for (const result of settled) {
    if (result.status === "fulfilled") {
      results.push(result.value);
    }
  }

  return results;
}

// ── Persist health check results ──

/**
 * Map from HealthStatus (internal) to the DB enum value.
 * The DB uses "paused" where the checker returns "auth_expired".
 */
function toDbStatus(status: HealthStatus): "healthy" | "degraded" | "unhealthy" | "paused" {
  if (status === "auth_expired") return "paused";
  return status;
}

/**
 * Returns the drizzle table reference for a given platform's integration table.
 */
function getIntegrationTable(platform: IntegrationPlatform) {
  const tables = {
    devto: devtoIntegrations,
    ghost: ghostIntegrations,
    medium: mediumIntegrations,
    twitter: twitterIntegrations,
    linkedin: linkedinIntegrations,
    wordpress: wordpressConnections,
  } as const;
  return tables[platform];
}

/**
 * Upserts health check results into the integrationHealthChecks table.
 * When a check returns "auth_expired", pauses the integration (healthStatus='paused', disabled).
 * When a check returns "healthy", restores the integration if it was previously paused.
 */
export async function persistHealthCheckResults(
  workspaceId: string,
  results: HealthCheckResult[]
): Promise<void> {
  for (const result of results) {
    const dbStatus = toDbStatus(result.status);
    const traceId = crypto.randomUUID();

    // Emit health check event
    eventBus.emit(
      createAgentEvent(traceId, workspaceId, "integration-health", "integration:health_check", {
        platform: result.platform,
        status: result.status,
        responseTimeMs: result.responseTimeMs,
        errorMessage: result.errorMessage,
        errorCode: result.errorCode,
      })
    );

    // Emit auth_expired event when credentials are invalid
    if (result.status === "auth_expired") {
      eventBus.emit(
        createAgentEvent(traceId, workspaceId, "integration-health", "integration:auth_expired", {
          platform: result.platform,
          errorMessage: result.errorMessage,
          errorCode: result.errorCode,
        })
      );
    }

    // Upsert the health check record (unique on workspace + platform)
    const existing = await db
      .select({ id: integrationHealthChecks.id })
      .from(integrationHealthChecks)
      .where(
        and(
          eq(integrationHealthChecks.workspaceId, workspaceId),
          eq(integrationHealthChecks.platform, result.platform)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(integrationHealthChecks)
        .set({
          status: dbStatus,
          lastCheckedAt: new Date(),
          errorMessage: result.errorMessage ?? null,
          errorCode: result.errorCode ?? null,
          responseTimeMs: result.responseTimeMs,
        })
        .where(eq(integrationHealthChecks.id, existing[0].id));
    } else {
      await db.insert(integrationHealthChecks).values({
        workspaceId,
        platform: result.platform,
        status: dbStatus,
        lastCheckedAt: new Date(),
        errorMessage: result.errorMessage ?? null,
        errorCode: result.errorCode ?? null,
        responseTimeMs: result.responseTimeMs,
      });
    }

    // Update the integration table's healthStatus and enabled/isActive flag
    await updateIntegrationStatus(workspaceId, result);
  }
}

async function updateIntegrationStatus(
  workspaceId: string,
  result: HealthCheckResult
): Promise<void> {
  const dbStatus = toDbStatus(result.status);
  const table = getIntegrationTable(result.platform);
  const traceId = crypto.randomUUID();

  if (result.platform === "wordpress") {
    // WordPress uses isActive instead of enabled
    if (result.status === "auth_expired") {
      await db
        .update(wordpressConnections)
        .set({ healthStatus: dbStatus, isActive: false })
        .where(eq(wordpressConnections.workspaceId, workspaceId));

      eventBus.emit(
        createAgentEvent(traceId, workspaceId, "integration-health", "integration:connector_paused", {
          platform: result.platform,
          reason: "auth_expired",
        })
      );
    } else if (result.status === "healthy") {
      // Restore if previously paused
      const [row] = await db
        .select({ healthStatus: wordpressConnections.healthStatus })
        .from(wordpressConnections)
        .where(eq(wordpressConnections.workspaceId, workspaceId))
        .limit(1);

      if (row?.healthStatus === "paused") {
        await db
          .update(wordpressConnections)
          .set({ healthStatus: dbStatus, isActive: true })
          .where(eq(wordpressConnections.workspaceId, workspaceId));

        eventBus.emit(
          createAgentEvent(traceId, workspaceId, "integration-health", "integration:connector_resumed", {
            platform: result.platform,
            previousStatus: "paused",
          })
        );
      } else {
        await db
          .update(wordpressConnections)
          .set({ healthStatus: dbStatus })
          .where(eq(wordpressConnections.workspaceId, workspaceId));
      }
    } else {
      await db
        .update(wordpressConnections)
        .set({ healthStatus: dbStatus })
        .where(eq(wordpressConnections.workspaceId, workspaceId));
    }
    return;
  }

  // All other platforms use `enabled` boolean
  if (result.status === "auth_expired") {
    await db
      .update(table)
      .set({ healthStatus: dbStatus, enabled: false } as Record<string, unknown>)
      .where(eq(table.workspaceId, workspaceId));

    eventBus.emit(
      createAgentEvent(traceId, workspaceId, "integration-health", "integration:connector_paused", {
        platform: result.platform,
        reason: "auth_expired",
      })
    );
  } else if (result.status === "healthy") {
    // Restore if previously paused due to auth
    const [row] = await db
      .select({ healthStatus: table.healthStatus })
      .from(table)
      .where(eq(table.workspaceId, workspaceId))
      .limit(1);

    if (row?.healthStatus === "paused") {
      await db
        .update(table)
        .set({ healthStatus: dbStatus, enabled: true } as Record<string, unknown>)
        .where(eq(table.workspaceId, workspaceId));

      eventBus.emit(
        createAgentEvent(traceId, workspaceId, "integration-health", "integration:connector_resumed", {
          platform: result.platform,
          previousStatus: "paused",
        })
      );
    } else {
      await db
        .update(table)
        .set({ healthStatus: dbStatus })
        .where(eq(table.workspaceId, workspaceId));
    }
  } else {
    await db
      .update(table)
      .set({ healthStatus: dbStatus })
      .where(eq(table.workspaceId, workspaceId));
  }
}
