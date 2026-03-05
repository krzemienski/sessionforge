import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mediumIntegrations, workspaces } from "@sessionforge/db";
import { eq } from "drizzle-orm";
import {
  exchangeCodeForToken,
  verifyMediumToken,
  MediumApiError,
} from "@/lib/integrations/medium";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.redirect(
      new URL("/auth/signin?error=unauthorized", request.url)
    );
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Handle OAuth errors (user denied access, etc.)
  if (error) {
    const errorDescription = searchParams.get("error_description") || "OAuth authorization failed";
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(errorDescription)}`, request.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/?error=missing_oauth_params", request.url)
    );
  }

  // Decode and validate state parameter
  let stateData: { workspaceSlug: string; userId: string };
  try {
    const decoded = Buffer.from(state, "base64").toString();
    stateData = JSON.parse(decoded);
  } catch (err) {
    return NextResponse.redirect(
      new URL("/?error=invalid_state", request.url)
    );
  }

  const { workspaceSlug, userId } = stateData;

  if (userId !== session.user.id) {
    return NextResponse.redirect(
      new URL("/?error=session_mismatch", request.url)
    );
  }

  // Verify workspace exists and user owns it
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, workspaceSlug),
  });

  if (!workspace || workspace.ownerId !== session.user.id) {
    return NextResponse.redirect(
      new URL("/?error=workspace_not_found", request.url)
    );
  }

  // Get OAuth configuration
  const clientId = process.env.MEDIUM_CLIENT_ID;
  const clientSecret = process.env.MEDIUM_CLIENT_SECRET;
  const redirectUri = process.env.MEDIUM_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(
      new URL(
        `/${workspaceSlug}/settings/integrations?error=oauth_config_missing`,
        request.url
      )
    );
  }

  try {
    // Exchange authorization code for access token
    const tokenResponse = await exchangeCodeForToken(
      {
        clientId,
        clientSecret,
        redirectUri,
      },
      code
    );

    // Verify token and get user info
    const mediumUser = await verifyMediumToken(tokenResponse.access_token);

    // Store integration in database
    await db
      .insert(mediumIntegrations)
      .values({
        workspaceId: workspace.id,
        apiKey: tokenResponse.access_token,
        username: mediumUser.username,
        enabled: true,
      })
      .onConflictDoUpdate({
        target: mediumIntegrations.workspaceId,
        set: {
          apiKey: tokenResponse.access_token,
          username: mediumUser.username,
          enabled: true,
          updatedAt: new Date(),
        },
      });

    // Redirect to settings page with success message
    return NextResponse.redirect(
      new URL(
        `/${workspaceSlug}/settings/integrations?medium=connected`,
        request.url
      )
    );
  } catch (error) {
    if (error instanceof MediumApiError) {
      return NextResponse.redirect(
        new URL(
          `/${workspaceSlug}/settings/integrations?error=${encodeURIComponent(error.message)}`,
          request.url
        )
      );
    }
    return NextResponse.redirect(
      new URL(
        `/${workspaceSlug}/settings/integrations?error=connection_failed`,
        request.url
      )
    );
  }
}
