import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentTemplates } from "@sessionforge/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const template = await db.query.contentTemplates.findFirst({
    where: eq(contentTemplates.id, id),
    with: {
      creator: {
        columns: {
          id: true,
          name: true,
          email: true,
        },
      },
      workspace: true,
    },
  });

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  // Built-in templates (workspaceId is null) are accessible to everyone
  // Custom templates require workspace ownership verification
  if (template.workspaceId && template.workspace) {
    if (template.workspace.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return NextResponse.json({ template });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const existing = await db.query.contentTemplates.findFirst({
    where: eq(contentTemplates.id, id),
    with: { workspace: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  // Only custom templates can be updated
  if (existing.templateType === "built_in") {
    return NextResponse.json(
      { error: "Built-in templates cannot be modified" },
      { status: 403 }
    );
  }

  // Verify workspace ownership
  if (!existing.workspace || existing.workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { name, description, structure, toneGuidance, exampleContent, isActive } = body;

  // Build update object with only provided fields
  const updateData: Record<string, any> = {};
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (structure !== undefined) updateData.structure = structure;
  if (toneGuidance !== undefined) updateData.toneGuidance = toneGuidance;
  if (exampleContent !== undefined) updateData.exampleContent = exampleContent;
  if (isActive !== undefined) updateData.isActive = isActive;

  const [updated] = await db
    .update(contentTemplates)
    .set(updateData)
    .where(eq(contentTemplates.id, id))
    .returning();

  return NextResponse.json({ template: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const existing = await db.query.contentTemplates.findFirst({
    where: eq(contentTemplates.id, id),
    with: { workspace: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  // Only custom templates can be deleted
  if (existing.templateType === "built_in") {
    return NextResponse.json(
      { error: "Built-in templates cannot be deleted" },
      { status: 403 }
    );
  }

  // Verify workspace ownership
  if (!existing.workspace || existing.workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.delete(contentTemplates).where(eq(contentTemplates.id, id));

  return NextResponse.json({ deleted: true });
}
