import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { getRedis } from "@/lib/redis";
import {
  checkAllIntegrations,
  persistHealthCheckResults,
  type IntegrationPlatform,
  type HealthCheckResult,
} from "@/lib/integrations/health-checker";

export const dynamic = "force-dynamic";

// ── In-memory rate limit fallback (when Redis is unavailable) ──

const RATE_LIMIT_SECONDS = 60;

const inMemoryRateLimit = new Map<string, number>();

async function isRateLimited(workspaceId: string): Promise<boolean> {
  const redis = await getRedis();
  const key = `health-check:rate-limit:${workspaceId}`;

  if (redis) {
    const existing = await redis.get(key);
    if (existing) return true;
    await redis.set(key, "1", { ex: RATE_LIMIT_SECONDS });
    return false;
  }

  // Fallback: in-memory map
  const now = Date.now();
  const lastCheck = inMemoryRateLimit.get(workspaceId);

  if (lastCheck && now - lastCheck < RATE_LIMIT_SECONDS * 1000) {
    return true;
  }

  inMemoryRateLimit.set(workspaceId, now);

  // Lazy cleanup of stale entries
  if (inMemoryRateLimit.size > 1000) {
    for (const [id, ts] of inMemoryRateLimit) {
      if (now - ts > RATE_LIMIT_SECONDS * 1000) {
        inMemoryRateLimit.delete(id);
      }
    }
  }

  return false;
}

// ── Validation ──

const VALID_PLATFORMS: Set<string> = new Set([
  "devto",
  "ghost",
  "medium",
  "twitter",
  "linkedin",
  "wordpress",
]);

export async function POST(request: Request) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { searchParams } = new URL(request.url);
    const workspaceSlug = searchParams.get("workspace");

    if (!workspaceSlug)
      throw new AppError("workspace query param required", ERROR_CODES.BAD_REQUEST);

    const rawBody = await request.json().catch(() => ({}));
    const platform = rawBody.platform as string | undefined;

    if (platform && !VALID_PLATFORMS.has(platform)) {
      throw new AppError(
        `Invalid platform: ${platform}. Must be one of: ${[...VALID_PLATFORMS].join(", ")}`,
        ERROR_CODES.BAD_REQUEST
      );
    }

    const { workspace } = await getAuthorizedWorkspace(session, workspaceSlug, PERMISSIONS.INTEGRATIONS_MANAGE);

    // Rate limit: max 1 check per workspace per 60 seconds
    if (await isRateLimited(workspace.id)) {
      throw new AppError(
        "Health check already ran recently. Please wait 60 seconds between checks.",
        ERROR_CODES.BAD_REQUEST,
        429
      );
    }

    // Run health checks
    let results: HealthCheckResult[];

    if (platform) {
      // Check only the specified platform via checkAllIntegrations
      // (it filters by what's actually connected, so we filter the results)
      const allResults = await checkAllIntegrations(workspace.id);
      results = allResults.filter(
        (r) => r.platform === (platform as IntegrationPlatform)
      );
    } else {
      results = await checkAllIntegrations(workspace.id);
    }

    // Persist results
    await persistHealthCheckResults(workspace.id, results);

    return NextResponse.json(
      {
        checked: results.length,
        results: results.map((r) => ({
          platform: r.platform,
          status: r.status,
          responseTimeMs: r.responseTimeMs,
          errorMessage: r.errorMessage ?? null,
          errorCode: r.errorCode ?? null,
        })),
      },
      { status: 200 }
    );
  })(request);
}
