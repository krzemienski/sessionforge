import { db } from "@/lib/db";
import { workspaces, workspaceMembers, workspaceActivity } from "@sessionforge/db";
import { eq, and } from "drizzle-orm/sql";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { hasPermission, ROLES } from "@/lib/permissions";
import type { Permission, Role } from "@/lib/permissions";
import type { Session } from "@/lib/auth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthorizedWorkspaceResult {
  workspace: typeof workspaces.$inferSelect;
  member?: typeof workspaceMembers.$inferSelect;
  role: Role;
}

// ---------------------------------------------------------------------------
// getAuthorizedWorkspace — look up by slug
// ---------------------------------------------------------------------------

export async function getAuthorizedWorkspace(
  session: Session,
  slug: string,
  requiredPermission?: Permission
): Promise<AuthorizedWorkspaceResult> {
  const rows = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.slug, slug))
    .limit(1);

  if (!rows.length) {
    throw new AppError("Workspace not found", ERROR_CODES.NOT_FOUND);
  }

  const workspace = rows[0];
  return authorizeUser(session, workspace, requiredPermission);
}

// ---------------------------------------------------------------------------
// getAuthorizedWorkspaceById — look up by ID
// ---------------------------------------------------------------------------

export async function getAuthorizedWorkspaceById(
  session: Session,
  workspaceId: string,
  requiredPermission?: Permission
): Promise<AuthorizedWorkspaceResult> {
  const rows = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!rows.length) {
    throw new AppError("Workspace not found", ERROR_CODES.NOT_FOUND);
  }

  const workspace = rows[0];
  return authorizeUser(session, workspace, requiredPermission);
}

// ---------------------------------------------------------------------------
// Shared authorization logic
// ---------------------------------------------------------------------------

async function authorizeUser(
  session: Session,
  workspace: typeof workspaces.$inferSelect,
  requiredPermission?: Permission
): Promise<AuthorizedWorkspaceResult> {
  // Owner always has full access
  if (workspace.ownerId === session.user.id) {
    return { workspace, role: ROLES.OWNER };
  }

  // Fall back to workspace membership
  const memberRows = await db
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspace.id),
        eq(workspaceMembers.userId, session.user.id)
      )
    )
    .limit(1);

  if (!memberRows.length) {
    // User has no access — return NOT_FOUND to avoid leaking workspace existence
    throw new AppError("Workspace not found", ERROR_CODES.NOT_FOUND);
  }

  const member = memberRows[0];
  const role = member.role as Role;

  // Check permission if required
  if (requiredPermission) {
    const customPerms = member.customPermissions
      ? (Object.entries(member.customPermissions)
          .filter(([, v]) => v)
          .map(([k]) => k) as Permission[])
      : undefined;

    if (!hasPermission(role, requiredPermission, customPerms)) {
      throw new AppError(
        "You do not have permission to perform this action",
        ERROR_CODES.FORBIDDEN
      );
    }
  }

  return { workspace, member, role };
}

// ---------------------------------------------------------------------------
// Audit logging utility
// ---------------------------------------------------------------------------

export async function logWorkspaceActivity(
  workspaceId: string,
  userId: string,
  action: string,
  resourceType?: string,
  resourceId?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await db.insert(workspaceActivity).values({
    workspaceId,
    userId,
    action,
    resourceType: resourceType ?? null,
    resourceId: resourceId ?? null,
    metadata: metadata ?? null,
  });
}
