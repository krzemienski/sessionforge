import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces, integrationSettings } from "@sessionforge/db";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

function maskToken(token: string | null | undefined): string | null {
  if (!token) return null;
  if (token.length <= 8) return "********";
  return token.slice(0, 8) + "...";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;

  const workspace = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(
      and(
        eq(workspaces.ownerId, session.user.id),
        eq(workspaces.slug, slug)
      )
    )
    .limit(1);

  if (!workspace.length) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const wsId = workspace[0].id;

  const rows = await db
    .select()
    .from(integrationSettings)
    .where(eq(integrationSettings.workspaceId, wsId))
    .limit(1);

  if (!rows.length) {
    return NextResponse.json({
      hashnodeApiToken: null,
      hashnodePublicationId: null,
      hashnodeDefaultCanonicalDomain: null,
    });
  }

  const settings = rows[0];

  return NextResponse.json({
    hashnodeApiToken: maskToken(settings.hashnodeApiToken),
    hashnodePublicationId: settings.hashnodePublicationId,
    hashnodeDefaultCanonicalDomain: settings.hashnodeDefaultCanonicalDomain,
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;

  const workspace = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(
      and(
        eq(workspaces.ownerId, session.user.id),
        eq(workspaces.slug, slug)
      )
    )
    .limit(1);

  if (!workspace.length) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const wsId = workspace[0].id;
  const body = await req.json().catch(() => ({}));

  const { hashnodeToken, hashnodePublicationId, hashnodeDefaultCanonicalDomain } =
    body as Record<string, unknown>;

  const updateValues: Record<string, unknown> = {};
  if (hashnodeToken !== undefined) updateValues.hashnodeApiToken = hashnodeToken;
  if (hashnodePublicationId !== undefined) updateValues.hashnodePublicationId = hashnodePublicationId;
  if (hashnodeDefaultCanonicalDomain !== undefined)
    updateValues.hashnodeDefaultCanonicalDomain = hashnodeDefaultCanonicalDomain;

  const existing = await db
    .select({ id: integrationSettings.id })
    .from(integrationSettings)
    .where(eq(integrationSettings.workspaceId, wsId))
    .limit(1);

  let result;
  if (existing.length > 0) {
    [result] = await db
      .update(integrationSettings)
      .set(updateValues)
      .where(eq(integrationSettings.workspaceId, wsId))
      .returning();
  } else {
    [result] = await db
      .insert(integrationSettings)
      .values({ workspaceId: wsId, ...updateValues })
      .returning();
  }

  return NextResponse.json({
    hashnodeApiToken: maskToken(result.hashnodeApiToken),
    hashnodePublicationId: result.hashnodePublicationId,
    hashnodeDefaultCanonicalDomain: result.hashnodeDefaultCanonicalDomain,
  });
}
