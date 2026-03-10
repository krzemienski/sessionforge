import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scanSources, workspaces } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";
import { encryptPassword } from "@/lib/crypto/source-credentials";

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

  const sources = await db
    .select()
    .from(scanSources)
    .where(eq(scanSources.workspaceId, workspace.id));

  const masked = sources.map((s) => ({
    ...s,
    encryptedPassword: "••••••••",
  }));

  return NextResponse.json({ sources: masked });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { workspaceSlug, label, host, port, username, password, basePath } = body;

  if (!workspaceSlug || !label || !host || !username || !password) {
    return NextResponse.json(
      { error: "workspaceSlug, label, host, username, and password are required" },
      { status: 400 }
    );
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, workspaceSlug),
  });
  if (!workspace || workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const [source] = await db
    .insert(scanSources)
    .values({
      workspaceId: workspace.id,
      label,
      host,
      port: port ?? 22,
      username,
      encryptedPassword: encryptPassword(password),
      basePath: basePath ?? "~/.claude",
    })
    .returning();

  return NextResponse.json(
    { ...source, encryptedPassword: "••••••••" },
    { status: 201 }
  );
}
