import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaceMembers, workspaceActivity } from "@sessionforge/db";
import { eq, and } from "drizzle-orm/sql";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS, ROLES } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ slug: string; memberId: string }> }
) {
  const { slug, memberId } = await ctx.params;
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { workspace } = await getAuthorizedWorkspace(
      session,
      slug,
      PERMISSIONS.WORKSPACE_MEMBERS
    );

    const body = await req.json().catch(() => ({}));
    const { role: newRole } = body;

    const validRoles = ["owner", "editor", "publisher", "reviewer", "analyst", "viewer"];
    if (!newRole || !validRoles.includes(newRole)) {
      throw new AppError(
        `role must be one of: ${validRoles.join(", ")}`,
        ERROR_CODES.BAD_REQUEST
      );
    }

    // Fetch the target member
    const memberRows = await db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.id, memberId),
          eq(workspaceMembers.workspaceId, workspace.id)
        )
      )
      .limit(1);

    if (!memberRows.length) {
      throw new AppError("Member not found", ERROR_CODES.NOT_FOUND);
    }

    const targetMember = memberRows[0];

    // Cannot change owner role
    if (targetMember.role === ROLES.OWNER) {
      throw new AppError(
        "Cannot change the role of a workspace owner",
        ERROR_CODES.FORBIDDEN
      );
    }

    // Cannot change own role
    if (targetMember.userId === session.user.id) {
      throw new AppError(
        "Cannot change your own role",
        ERROR_CODES.FORBIDDEN
      );
    }

    // Cannot assign owner role to a member
    if (newRole === ROLES.OWNER) {
      throw new AppError(
        "Cannot assign owner role to a member",
        ERROR_CODES.FORBIDDEN
      );
    }

    const previousRole = targetMember.role;

    const [updated] = await db
      .update(workspaceMembers)
      .set({ role: newRole })
      .where(eq(workspaceMembers.id, memberId))
      .returning();

    // Log activity
    await db.insert(workspaceActivity).values({
      workspaceId: workspace.id,
      userId: session.user.id,
      action: "member.role_changed",
      resourceType: "member",
      resourceId: memberId,
      metadata: {
        targetUserId: targetMember.userId,
        previousRole,
        newRole,
      },
    });

    return NextResponse.json({ member: updated });
  })(req);
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ slug: string; memberId: string }> }
) {
  const { slug, memberId } = await ctx.params;
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { workspace } = await getAuthorizedWorkspace(
      session,
      slug,
      PERMISSIONS.WORKSPACE_MEMBERS
    );

    // Fetch the target member
    const memberRows = await db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.id, memberId),
          eq(workspaceMembers.workspaceId, workspace.id)
        )
      )
      .limit(1);

    if (!memberRows.length) {
      throw new AppError("Member not found", ERROR_CODES.NOT_FOUND);
    }

    const targetMember = memberRows[0];

    // Cannot remove owner
    if (targetMember.role === ROLES.OWNER) {
      throw new AppError(
        "Cannot remove a workspace owner",
        ERROR_CODES.FORBIDDEN
      );
    }

    await db
      .delete(workspaceMembers)
      .where(eq(workspaceMembers.id, memberId));

    // Log activity
    await db.insert(workspaceActivity).values({
      workspaceId: workspace.id,
      userId: session.user.id,
      action: "member.removed",
      resourceType: "member",
      resourceId: memberId,
      metadata: {
        targetUserId: targetMember.userId,
        role: targetMember.role,
      },
    });

    return NextResponse.json({ removed: true });
  })(req);
}
