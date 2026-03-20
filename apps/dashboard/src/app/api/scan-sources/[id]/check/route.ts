import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scanSources } from "@sessionforge/db";
import { and, eq } from "drizzle-orm/sql";
import { checkRemoteConnection } from "@/lib/sessions/ssh-scanner";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { workspaceSlug } = body;

  if (!workspaceSlug) {
    return NextResponse.json({ error: "workspaceSlug required" }, { status: 400 });
  }

  const { workspace } = await getAuthorizedWorkspace(
    session,
    workspaceSlug,
    PERMISSIONS.SESSIONS_SCAN
  );

  const [source] = await db
    .select()
    .from(scanSources)
    .where(
      and(eq(scanSources.id, id), eq(scanSources.workspaceId, workspace.id))
    );

  if (!source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  try {
    const { sessionsFound } = await checkRemoteConnection({
      host: source.host,
      port: source.port ?? 22,
      username: source.username,
      encryptedPassword: source.encryptedPassword,
      basePath: source.basePath ?? "~/.claude",
      label: source.label,
    });

    return NextResponse.json({
      success: true,
      sessionsFound,
      message: `Connected to ${source.host}. Found ${sessionsFound} session files.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: message },
      { status: 502 }
    );
  }
}
