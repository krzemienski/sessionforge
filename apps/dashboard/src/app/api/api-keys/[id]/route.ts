import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiKeys } from "@sessionforge/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const existing = await db.query.apiKeys.findFirst({
    where: eq(apiKeys.id, id),
    with: { workspace: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "API key not found" }, { status: 404 });
  }

  if (existing.workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.delete(apiKeys).where(eq(apiKeys.id, id));

  return NextResponse.json({ deleted: true });
}
