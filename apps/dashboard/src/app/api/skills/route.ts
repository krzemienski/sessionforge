import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { writingSkills } from "@sessionforge/db";
import { eq, asc } from "drizzle-orm/sql";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const workspaceSlug = searchParams.get("workspace");

  if (!workspaceSlug) {
    return NextResponse.json({ error: "workspace query param required" }, { status: 400 });
  }

  const { workspace } = await getAuthorizedWorkspace(
    session,
    workspaceSlug,
    PERMISSIONS.CONTENT_READ
  );

  const skills = await db.query.writingSkills.findMany({
    where: eq(writingSkills.workspaceId, workspace.id),
    orderBy: [asc(writingSkills.createdAt)],
  });

  return NextResponse.json({ skills });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { workspaceSlug, name, description, instructions, appliesTo, source } = body;

  if (!workspaceSlug || !name || !instructions) {
    return NextResponse.json(
      { error: "workspaceSlug, name, and instructions are required" },
      { status: 400 }
    );
  }

  const { workspace } = await getAuthorizedWorkspace(
    session,
    workspaceSlug,
    PERMISSIONS.CONTENT_CREATE
  );

  const [skill] = await db
    .insert(writingSkills)
    .values({
      workspaceId: workspace.id,
      name,
      description: description ?? null,
      instructions,
      appliesTo: appliesTo ?? null,
      source: source ?? "custom",
    })
    .returning();

  return NextResponse.json({ skill }, { status: 201 });
}
