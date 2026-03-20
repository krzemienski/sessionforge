import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  workspaceInvites,
  workspaceMembers,
  workspaceActivity,
  workspaces,
} from "@sessionforge/db";
import { eq, and } from "drizzle-orm/sql";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string; token: string }> }
) {
  const { slug, token } = await ctx.params;
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    // Verify workspace exists
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.slug, slug))
      .limit(1);

    if (!workspace) {
      throw new AppError("Workspace not found", ERROR_CODES.NOT_FOUND);
    }

    // Find the invite by token
    const [invite] = await db
      .select()
      .from(workspaceInvites)
      .where(
        and(
          eq(workspaceInvites.token, token),
          eq(workspaceInvites.workspaceId, workspace.id)
        )
      )
      .limit(1);

    if (!invite) {
      throw new AppError("Invite not found", ERROR_CODES.NOT_FOUND);
    }

    // Check if already accepted
    if (invite.acceptedAt) {
      throw new AppError(
        "This invite has already been accepted",
        ERROR_CODES.BAD_REQUEST
      );
    }

    // Check if expired
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      throw new AppError(
        "This invite has expired",
        ERROR_CODES.BAD_REQUEST
      );
    }

    // Check if user is already a member
    const existingMember = await db
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspace.id),
          eq(workspaceMembers.userId, session.user.id)
        )
      )
      .limit(1);

    if (existingMember.length) {
      throw new AppError(
        "You are already a member of this workspace",
        ERROR_CODES.BAD_REQUEST
      );
    }

    // Create workspace member with the invited role
    const [member] = await db
      .insert(workspaceMembers)
      .values({
        workspaceId: workspace.id,
        userId: session.user.id,
        role: invite.role,
        invitedBy: invite.invitedBy,
      })
      .returning();

    // Mark invite as accepted
    await db
      .update(workspaceInvites)
      .set({ acceptedAt: new Date() })
      .where(eq(workspaceInvites.id, invite.id));

    // Log activity
    await db.insert(workspaceActivity).values({
      workspaceId: workspace.id,
      userId: session.user.id,
      action: "invite.accepted",
      resourceType: "invite",
      resourceId: invite.id,
      metadata: { email: invite.email, role: invite.role },
    });

    return NextResponse.json({ member }, { status: 201 });
  })(req);
}
