import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { platformSettings, workspaces } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const workspaceSlug = searchParams.get("workspace");

  if (!workspaceSlug) {
    return NextResponse.json({ error: "workspace query param required" }, { status: 400 });
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, workspaceSlug),
  });

  if (!workspace || workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const settings = await db.query.platformSettings.findFirst({
    where: eq(platformSettings.workspaceId, workspace.id),
  });

  if (!settings) {
    return NextResponse.json({
      devtoApiKey: null,
      devtoUsername: null,
      hashnodeApiKey: null,
      hashnodeUsername: null,
      devtoConnected: false,
      hashnodeConnected: false,
    });
  }

  return NextResponse.json({
    devtoApiKey: settings.devtoApiKey ? `${settings.devtoApiKey.slice(0, 4)}${"*".repeat(8)}` : null,
    devtoUsername: settings.devtoUsername,
    hashnodeApiKey: settings.hashnodeApiKey ? `${settings.hashnodeApiKey.slice(0, 4)}${"*".repeat(8)}` : null,
    hashnodeUsername: settings.hashnodeUsername,
    devtoConnected: !!settings.devtoApiKey,
    hashnodeConnected: !!settings.hashnodeApiKey,
  });
}

export async function PUT(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { workspaceSlug, devtoApiKey, devtoUsername, hashnodeApiKey, hashnodeUsername } = body;

  if (!workspaceSlug) {
    return NextResponse.json({ error: "workspaceSlug is required" }, { status: 400 });
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, workspaceSlug),
  });

  if (!workspace || workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const [updated] = await db
    .insert(platformSettings)
    .values({
      workspaceId: workspace.id,
      devtoApiKey: devtoApiKey ?? null,
      devtoUsername: devtoUsername ?? null,
      hashnodeApiKey: hashnodeApiKey ?? null,
      hashnodeUsername: hashnodeUsername ?? null,
    })
    .onConflictDoUpdate({
      target: platformSettings.workspaceId,
      set: {
        devtoApiKey: devtoApiKey ?? null,
        devtoUsername: devtoUsername ?? null,
        hashnodeApiKey: hashnodeApiKey ?? null,
        hashnodeUsername: hashnodeUsername ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();

  return NextResponse.json({
    devtoConnected: !!updated.devtoApiKey,
    hashnodeConnected: !!updated.hashnodeApiKey,
    devtoUsername: updated.devtoUsername,
    hashnodeUsername: updated.hashnodeUsername,
  });
}
