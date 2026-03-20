import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { twitterIntegrations } from "@sessionforge/db";
import { eq } from "drizzle-orm";
import { verifyTwitterAuth, TwitterApiError } from "@/lib/integrations/twitter";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const TWITTER_TOKEN_URL = "https://api.twitter.com/2/oauth2/token";

interface TwitterTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
  scope: string;
}

async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<TwitterTokenResponse> {
  const clientId = process.env.TWITTER_CLIENT_ID;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET;

  if (!clientId) {
    throw new Error("Twitter OAuth not configured");
  }

  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
    client_id: clientId,
  });

  const authHeader = clientSecret
    ? `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`
    : undefined;

  const response = await fetch(TWITTER_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to exchange Twitter OAuth code: ${body}`);
  }

  return response.json() as Promise<TwitterTokenResponse>;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") ?? "";

  function getCookie(name: string): string | null {
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
  }

  const storedState = getCookie("twitter_oauth_state");
  const storedCodeVerifier = getCookie("twitter_oauth_code_verifier");
  const storedWorkspaceSlug = getCookie("twitter_oauth_workspace");

  if (error) {
    return NextResponse.redirect(
      `${appUrl}/settings/integrations?twitter_error=${encodeURIComponent(error)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${appUrl}/settings/integrations?twitter_error=missing_params`
    );
  }

  if (!storedState || state !== storedState) {
    return NextResponse.redirect(
      `${appUrl}/settings/integrations?twitter_error=invalid_state`
    );
  }

  if (!storedCodeVerifier || !storedWorkspaceSlug) {
    return NextResponse.redirect(
      `${appUrl}/settings/integrations?twitter_error=missing_session`
    );
  }

  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) {
    return NextResponse.redirect(`${appUrl}/login`);
  }

  // Verify workspace access with integrations:manage permission
  let workspace: Awaited<ReturnType<typeof getAuthorizedWorkspace>>["workspace"];
  try {
    const result = await getAuthorizedWorkspace(
      session,
      storedWorkspaceSlug,
      PERMISSIONS.INTEGRATIONS_MANAGE
    );
    workspace = result.workspace;
  } catch {
    return NextResponse.redirect(
      `${appUrl}/settings/integrations?twitter_error=workspace_not_found`
    );
  }

  try {
    const redirectUri = `${appUrl}/api/integrations/twitter/callback`;

    const tokens = await exchangeCodeForTokens(code, storedCodeVerifier, redirectUri);

    const twitterUser = await verifyTwitterAuth(tokens.access_token);

    const accessTokenExpiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null;

    await db
      .insert(twitterIntegrations)
      .values({
        workspaceId: workspace.id,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        accessTokenExpiresAt,
        twitterUserId: twitterUser.id,
        username: twitterUser.username,
        enabled: true,
      })
      .onConflictDoUpdate({
        target: twitterIntegrations.workspaceId,
        set: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token ?? null,
          accessTokenExpiresAt,
          twitterUserId: twitterUser.id,
          username: twitterUser.username,
          enabled: true,
          updatedAt: new Date(),
        },
      });

    const response = NextResponse.redirect(
      `${appUrl}/settings/integrations?twitter_connected=true`
    );

    // Clear OAuth cookies
    const clearOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: 0,
      path: "/",
    };

    response.cookies.set("twitter_oauth_state", "", clearOptions);
    response.cookies.set("twitter_oauth_code_verifier", "", clearOptions);
    response.cookies.set("twitter_oauth_workspace", "", clearOptions);

    return response;
  } catch (err) {
    if (err instanceof TwitterApiError) {
      return NextResponse.redirect(
        `${appUrl}/settings/integrations?twitter_error=${encodeURIComponent(err.message)}`
      );
    }
    return NextResponse.redirect(
      `${appUrl}/settings/integrations?twitter_error=${encodeURIComponent(
        err instanceof Error ? err.message : "Failed to connect Twitter account"
      )}`
    );
  }
}
