import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  devtoIntegrations,
  ghostIntegrations,
  mediumIntegrations,
  twitterIntegrations,
  linkedinIntegrations,
  wordpressConnections,
} from "@sessionforge/db";
import { verifyDevtoApiKey } from "./devto";
import { verifyGhostApiKey } from "./ghost";
import { verifyMediumToken } from "./medium";
import { verifyTwitterAuth } from "./twitter";
import { verifyLinkedInAuth } from "./linkedin";

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
    checks.push(
      checkWordPressHealth(
        wordpress.siteUrl,
        wordpress.username,
        wordpress.encryptedAppPassword
      )
    );
  }

  const settled = await Promise.allSettled(checks);
  for (const result of settled) {
    if (result.status === "fulfilled") {
      results.push(result.value);
    }
  }

  return results;
}
