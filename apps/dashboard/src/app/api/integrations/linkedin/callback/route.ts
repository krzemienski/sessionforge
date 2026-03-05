import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { linkedinIntegrations, workspaces } from "@sessionforge/db";
import { eq } from "drizzle-orm";
import { verifyLinkedInAuth, LinkedInApiError } from "@/lib/integrations/linkedin";

export const dynamic = "force-dynamic";

const LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";

interface LinkedInTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
  scope?: string;
}

async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<LinkedInTokenResponse> {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("LinkedIn OAuth not configured");
  }

  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(LINKEDIN_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to exchange LinkedIn OAuth code: ${body}`);
  }

  return response.json() as Promise<LinkedInTokenResponse>;
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

  const storedState = getCookie("linkedin_oauth_state");
  const storedWorkspaceSlug = getCookie("linkedin_oauth_workspace");

  if (error) {
    return NextResponse.redirect(
      `${appUrl}/settings/integrations?linkedin_error=${encodeURIComponent(error)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${appUrl}/settings/integrations?linkedin_error=missing_params`
    );
  }

  if (!storedState || state !== storedState) {
    return NextResponse.redirect(
      `${appUrl}/settings/integrations?linkedin_error=invalid_state`
    );
  }

  if (!storedWorkspaceSlug) {
    return NextResponse.redirect(
      `${appUrl}/settings/integrations?linkedin_error=missing_session`
    );
  }

  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) {
    return NextResponse.redirect(`${appUrl}/login`);
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, storedWorkspaceSlug),
  });

  if (!workspace || workspace.ownerId !== session.user.id) {
    return NextResponse.redirect(
      `${appUrl}/settings/integrations?linkedin_error=workspace_not_found`
    );
  }

  try {
    const redirectUri = `${appUrl}/api/integrations/linkedin/callback`;

    const tokens = await exchangeCodeForTokens(code, redirectUri);

    const linkedInUser = await verifyLinkedInAuth(tokens.access_token);

    const accessTokenExpiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null;

    const username =
      linkedInUser.vanityName ??
      `${linkedInUser.firstName} ${linkedInUser.lastName}`.trim();

    await db
      .insert(linkedinIntegrations)
      .values({
        workspaceId: workspace.id,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        accessTokenExpiresAt,
        linkedinUserId: linkedInUser.id,
        username,
        enabled: true,
      })
      .onConflictDoUpdate({
        target: linkedinIntegrations.workspaceId,
        set: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token ?? null,
          accessTokenExpiresAt,
          linkedinUserId: linkedInUser.id,
          username,
          enabled: true,
          updatedAt: new Date(),
        },
      });

    const response = NextResponse.redirect(
      `${appUrl}/settings/integrations?linkedin_connected=true`
    );

    // Clear OAuth cookies
    const clearOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: 0,
      path: "/",
    };

    response.cookies.set("linkedin_oauth_state", "", clearOptions);
    response.cookies.set("linkedin_oauth_workspace", "", clearOptions);

    return response;
  } catch (err) {
    if (err instanceof LinkedInApiError) {
      return NextResponse.redirect(
        `${appUrl}/settings/integrations?linkedin_error=${encodeURIComponent(err.message)}`
      );
    }
    return NextResponse.redirect(
      `${appUrl}/settings/integrations?linkedin_error=${encodeURIComponent(
        err instanceof Error ? err.message : "Failed to connect LinkedIn account"
      )}`
    );
  }
}
