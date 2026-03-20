import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getOAuthUrl } from "@/lib/integrations/medium";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const workspaceSlug = searchParams.get("workspace");

  if (!workspaceSlug) {
    return NextResponse.json(
      { error: "workspace query param required" },
      { status: 400 }
    );
  }

  await getAuthorizedWorkspace(
    session,
    workspaceSlug,
    PERMISSIONS.INTEGRATIONS_MANAGE
  );

  // Generate OAuth URL with state parameter
  const clientId = process.env.MEDIUM_CLIENT_ID;
  const clientSecret = process.env.MEDIUM_CLIENT_SECRET;
  const redirectUri = process.env.MEDIUM_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      { error: "Medium OAuth configuration missing" },
      { status: 500 }
    );
  }

  // Encode workspace slug in state for retrieval in callback
  const state = Buffer.from(
    JSON.stringify({ workspaceSlug, userId: session.user.id })
  ).toString("base64");

  const oauthUrl = getOAuthUrl(
    {
      clientId,
      clientSecret,
      redirectUri,
    },
    state
  );

  // Redirect to Medium OAuth page
  return NextResponse.redirect(oauthUrl);
}
