import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces } from "@sessionforge/db";
import { eq } from "drizzle-orm";
import { getOAuthUrl } from "@/lib/integrations/medium";

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

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, workspaceSlug),
  });

  if (!workspace || workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

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
