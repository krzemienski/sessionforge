import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  integrationHealthChecks,
  devtoIntegrations,
  ghostIntegrations,
  mediumIntegrations,
  twitterIntegrations,
  linkedinIntegrations,
  wordpressConnections,
} from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type Platform = "devto" | "ghost" | "medium" | "twitter" | "linkedin" | "wordpress";

interface IntegrationHealth {
  platform: Platform;
  status: string;
  lastCheckedAt: Date | null;
  responseTimeMs: number | null;
  errorMessage: string | null;
  errorCode: string | null;
  connectedAt: Date | null;
  enabled: boolean;
}

const integrationQueries = {
  devto: {
    table: devtoIntegrations,
    enabledField: devtoIntegrations.enabled,
    createdAtField: devtoIntegrations.createdAt,
    workspaceIdField: devtoIntegrations.workspaceId,
  },
  ghost: {
    table: ghostIntegrations,
    enabledField: ghostIntegrations.enabled,
    createdAtField: ghostIntegrations.createdAt,
    workspaceIdField: ghostIntegrations.workspaceId,
  },
  medium: {
    table: mediumIntegrations,
    enabledField: mediumIntegrations.enabled,
    createdAtField: mediumIntegrations.createdAt,
    workspaceIdField: mediumIntegrations.workspaceId,
  },
  twitter: {
    table: twitterIntegrations,
    enabledField: twitterIntegrations.enabled,
    createdAtField: twitterIntegrations.createdAt,
    workspaceIdField: twitterIntegrations.workspaceId,
  },
  linkedin: {
    table: linkedinIntegrations,
    enabledField: linkedinIntegrations.enabled,
    createdAtField: linkedinIntegrations.createdAt,
    workspaceIdField: linkedinIntegrations.workspaceId,
  },
  wordpress: {
    table: wordpressConnections,
    enabledField: wordpressConnections.isActive,
    createdAtField: wordpressConnections.createdAt,
    workspaceIdField: wordpressConnections.workspaceId,
  },
} as const;

export async function GET(request: Request) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { searchParams } = new URL(request.url);
    const workspaceSlug = searchParams.get("workspace");

    if (!workspaceSlug)
      throw new AppError("workspace query param required", ERROR_CODES.BAD_REQUEST);

    const { workspace } = await getAuthorizedWorkspace(session, workspaceSlug, PERMISSIONS.INTEGRATIONS_READ);

    // Fetch health check records for this workspace
    const healthChecks = await db.query.integrationHealthChecks.findMany({
      where: eq(integrationHealthChecks.workspaceId, workspace.id),
    });

    const healthByPlatform = new Map(
      healthChecks.map((hc) => [hc.platform, hc])
    );

    // Query each connected integration for enabled/connectedAt status
    const results: IntegrationHealth[] = [];

    for (const [platform, config] of Object.entries(integrationQueries) as [Platform, (typeof integrationQueries)[Platform]][]) {
      const integration = await db
        .select({
          enabled: config.enabledField,
          createdAt: config.createdAtField,
        })
        .from(config.table)
        .where(eq(config.workspaceIdField, workspace.id))
        .limit(1);

      if (integration.length === 0) continue;

      const row = integration[0];
      const healthCheck = healthByPlatform.get(platform);

      results.push({
        platform: platform as Platform,
        status: healthCheck?.status ?? "healthy",
        lastCheckedAt: healthCheck?.lastCheckedAt ?? null,
        responseTimeMs: healthCheck?.responseTimeMs ?? null,
        errorMessage: healthCheck?.errorMessage ?? null,
        errorCode: healthCheck?.errorCode ?? null,
        connectedAt: row.createdAt ?? null,
        enabled: row.enabled ?? true,
      });
    }

    return NextResponse.json({ integrations: results });
  })(request);
}
