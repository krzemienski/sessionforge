import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaceInvites, workspaceActivity } from "@sessionforge/db";
import { eq, and, isNull } from "drizzle-orm/sql";
import { randomBytes } from "crypto";
import { withApiHandler } from "@/lib/api-handler";
import { parseBody, memberInviteSchema } from "@/lib/validation";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

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

    // Fetch pending invites (not yet accepted)
    const invites = await db
      .select()
      .from(workspaceInvites)
      .where(
        and(
          eq(workspaceInvites.workspaceId, workspace.id),
          isNull(workspaceInvites.acceptedAt)
        )
      );

    return NextResponse.json({ invites });
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

    const { workspace } = await getAuthorizedWorkspace(
      session,
      slug,
      PERMISSIONS.WORKSPACE_MEMBERS
    );

    const rawBody = await req.json().catch(() => ({}));
    const { email, role } = parseBody(memberInviteSchema, rawBody);

    // Check for existing pending invite with same email
    const existing = await db
      .select({ id: workspaceInvites.id })
      .from(workspaceInvites)
      .where(
        and(
          eq(workspaceInvites.workspaceId, workspace.id),
          eq(workspaceInvites.email, email),
          isNull(workspaceInvites.acceptedAt)
        )
      )
      .limit(1);

    if (existing.length) {
      throw new AppError(
        "A pending invite already exists for this email",
        ERROR_CODES.BAD_REQUEST
      );
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const [invite] = await db
      .insert(workspaceInvites)
      .values({
        workspaceId: workspace.id,
        email,
        role,
        token,
        expiresAt,
        invitedBy: session.user.id,
      })
      .returning();

    // Log activity
    await db.insert(workspaceActivity).values({
      workspaceId: workspace.id,
      userId: session.user.id,
      action: "invite.created",
      resourceType: "invite",
      resourceId: invite.id,
      metadata: { email, role },
    });

    return NextResponse.json({ invite }, { status: 201 });
  })(req);
}

export async function DELETE(
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

    const body = await req.json().catch(() => ({}));
    const { id } = body;

    if (!id || typeof id !== "string") {
      throw new AppError("id is required", ERROR_CODES.BAD_REQUEST);
    }

    // Find the invite
    const existing = await db
      .select()
      .from(workspaceInvites)
      .where(
        and(
          eq(workspaceInvites.id, id),
          eq(workspaceInvites.workspaceId, workspace.id)
        )
      )
      .limit(1);

    if (!existing.length) {
      throw new AppError("Invite not found", ERROR_CODES.NOT_FOUND);
    }

    await db.delete(workspaceInvites).where(eq(workspaceInvites.id, id));

    // Log activity
    await db.insert(workspaceActivity).values({
      workspaceId: workspace.id,
      userId: session.user.id,
      action: "invite.revoked",
      resourceType: "invite",
      resourceId: id,
      metadata: { email: existing[0].email, role: existing[0].role },
    });

    return NextResponse.json({ success: true });
  })(req);
}
