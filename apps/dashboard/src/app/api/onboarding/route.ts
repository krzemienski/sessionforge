import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, workspaces, workspaceMembers } from "@sessionforge/db";
import { eq, or } from "drizzle-orm/sql";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Check for owned workspace first
  const [ownedWorkspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.ownerId, session.user.id))
    .limit(1);

  // If no owned workspace, check for membership in any workspace
  let workspace = ownedWorkspace;
  if (!workspace) {
    const memberRow = await db.query.workspaceMembers.findFirst({
      where: eq(workspaceMembers.userId, session.user.id),
      with: { workspace: true },
    });
    workspace = memberRow?.workspace ?? undefined;
  }

  return NextResponse.json({
    completed: user.onboardingCompleted,
    hasWorkspace: !!workspace,
    workspaceSlug: workspace?.slug ?? null,
  });
}

export async function POST(_req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db
    .update(users)
    .set({ onboardingCompleted: true })
    .where(eq(users.id, session.user.id));

  return NextResponse.json({ success: true });
}
