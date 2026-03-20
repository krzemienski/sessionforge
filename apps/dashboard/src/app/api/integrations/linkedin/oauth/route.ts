import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const LINKEDIN_SCOPES = ["openid", "profile", "email", "w_member_social", "r_basicprofile"];

function generateState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Buffer.from(array).toString("base64url");
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const workspaceSlug = searchParams.get("workspace");

  if (!workspaceSlug) {
    return NextResponse.json({ error: "workspace query param required" }, { status: 400 });
  }

  await getAuthorizedWorkspace(
    session,
    workspaceSlug,
    PERMISSIONS.INTEGRATIONS_MANAGE
  );

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "LinkedIn OAuth not configured" }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const redirectUri = `${appUrl}/api/integrations/linkedin/callback`;

  const state = generateState();

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: LINKEDIN_SCOPES.join(" "),
    state,
  });

  const authUrl = `${LINKEDIN_AUTH_URL}?${params.toString()}`;

  const response = NextResponse.redirect(authUrl);

  // Store OAuth state in cookies for validation in the callback
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 10, // 10 minutes
    path: "/",
  };

  response.cookies.set("linkedin_oauth_state", state, cookieOptions);
  response.cookies.set("linkedin_oauth_workspace", workspaceSlug, cookieOptions);

  return response;
}
