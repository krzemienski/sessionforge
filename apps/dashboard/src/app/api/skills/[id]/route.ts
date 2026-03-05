import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { writingSkills } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const skill = await db.query.writingSkills.findFirst({
    where: eq(writingSkills.id, id),
    with: { workspace: true },
  });

  if (!skill) {
    return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  }

  if (skill.workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ skill });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const existing = await db.query.writingSkills.findFirst({
    where: eq(writingSkills.id, id),
    with: { workspace: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  }

  if (existing.workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { name, description, instructions, appliesTo, enabled } = body;

  const updates: Partial<{
    name: string;
    description: string | null;
    instructions: string;
    appliesTo: string[] | null;
    enabled: boolean;
  }> = {};

  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (instructions !== undefined) updates.instructions = instructions;
  if (appliesTo !== undefined) updates.appliesTo = appliesTo;
  if (enabled !== undefined) updates.enabled = enabled;

  const [updated] = await db
    .update(writingSkills)
    .set(updates)
    .where(eq(writingSkills.id, id))
    .returning();

  return NextResponse.json({ skill: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const existing = await db.query.writingSkills.findFirst({
    where: eq(writingSkills.id, id),
    with: { workspace: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  }

  if (existing.workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.delete(writingSkills).where(eq(writingSkills.id, id));

  return NextResponse.json({ deleted: true });
}
