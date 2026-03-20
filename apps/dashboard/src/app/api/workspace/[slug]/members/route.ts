import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces, workspaceMembers, users } from "@sessionforge/db";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/workspace/[slug]/members
 *
 * Returns workspace members (including the workspace owner).
 * Only workspace owners can list members.
 * Used by the ApprovalPanel to populate the reviewer assignment dropdown.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;

  const workspace = await db
    .select({ id: workspaces.id, ownerId: workspaces.ownerId })
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

  // Fetch workspace members with their user data
  const members = await db
    .select({
      userId: workspaceMembers.userId,
      userName: users.name,
      userEmail: users.email,
      userImage: users.image,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(eq(workspaceMembers.workspaceId, workspace[0].id));

  // Also include the workspace owner in the list (they may not be in workspaceMembers)
  const ownerInMembers = members.some((m) => m.userId === workspace[0].ownerId);

  let allMembers = members.map((m) => ({
    id: m.userId,
    name: m.userName,
    email: m.userEmail,
    image: m.userImage,
  }));

  if (!ownerInMembers) {
    // Fetch owner user data and prepend
    const ownerRows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
      })
      .from(users)
      .where(eq(users.id, workspace[0].ownerId))
      .limit(1);

    if (ownerRows.length > 0) {
      allMembers = [ownerRows[0], ...allMembers];
    }
  }

  return NextResponse.json({
    ownerId: workspace[0].ownerId,
    members: allMembers,
  });
}
