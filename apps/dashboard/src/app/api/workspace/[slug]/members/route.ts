import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaceMembers, workspaceActivity, users } from "@sessionforge/db";
import { eq, and } from "drizzle-orm/sql";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS, ROLES } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { workspace } = await getAuthorizedWorkspace(
      session,
      slug,
      PERMISSIONS.WORKSPACE_MEMBERS
    );

    // Fetch members with user info via join
    const members = await db
      .select({
        id: workspaceMembers.id,
        userId: workspaceMembers.userId,
        role: workspaceMembers.role,
        customPermissions: workspaceMembers.customPermissions,
        joinedAt: workspaceMembers.joinedAt,
        createdAt: workspaceMembers.createdAt,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
          image: users.image,
        },
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(workspaceMembers.userId, users.id))
      .where(eq(workspaceMembers.workspaceId, workspace.id));

    return NextResponse.json({ members });
  })(req);
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { workspace, role } = await getAuthorizedWorkspace(
      session,
      slug,
      PERMISSIONS.WORKSPACE_MEMBERS
    );

    // Only owners can directly add members
    if (role !== ROLES.OWNER) {
      throw new AppError(
        "Only workspace owners can directly add members",
        ERROR_CODES.FORBIDDEN
      );
    }

    const body = await req.json().catch(() => ({}));
    const { userId, role: memberRole } = body;

    if (!userId || typeof userId !== "string") {
      throw new AppError("userId is required", ERROR_CODES.BAD_REQUEST);
    }

    const validRoles = ["owner", "editor", "publisher", "reviewer", "analyst", "viewer"];
    if (!memberRole || !validRoles.includes(memberRole)) {
      throw new AppError(
        `role must be one of: ${validRoles.join(", ")}`,
        ERROR_CODES.BAD_REQUEST
      );
    }

    // Verify target user exists
    const targetUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!targetUser.length) {
      throw new AppError("User not found", ERROR_CODES.NOT_FOUND);
    }

    // Check if already a member
    const existing = await db
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspace.id),
          eq(workspaceMembers.userId, userId)
        )
      )
      .limit(1);

    if (existing.length) {
      throw new AppError(
        "User is already a member of this workspace",
        ERROR_CODES.BAD_REQUEST
      );
    }

    const [member] = await db
      .insert(workspaceMembers)
      .values({
        workspaceId: workspace.id,
        userId,
        role: memberRole,
        invitedBy: session.user.id,
      })
      .returning();

    // Log activity
    await db.insert(workspaceActivity).values({
      workspaceId: workspace.id,
      userId: session.user.id,
      action: "member.added",
      resourceType: "member",
      resourceId: member.id,
      metadata: { targetUserId: userId, role: memberRole },
    });

    return NextResponse.json({ member }, { status: 201 });
  })(req);
}
