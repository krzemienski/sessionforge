# Workspace Authorization Pattern

> **Category:** Technical Pattern
> **Last Updated:** 2026-04-18
> **Status:** Active

## Purpose

Provides consistent workspace membership validation and permission checking across all workspace-scoped routes.

## Context

**When to use this pattern:**
- Workspace-scoped routes (dashboard, content, settings)
- Operations requiring specific permissions
- Multi-tenant access control

**When NOT to use this pattern:**
- Unauthenticated routes (login, signup)
- System-level operations (admin tasks)

## Implementation

### Overview

Three functions handle workspace auth:
1. `getAuthorizedWorkspace()` — lookup by slug, validate membership
2. `getAuthorizedWorkspaceById()` — lookup by ID, validate membership
3. `withWorkspaceAuth()` — wrapper for route handlers

### Key Components

**getAuthorizedWorkspace**
- Purpose: Look up workspace by slug, validate user membership/permissions
- Location: `apps/dashboard/src/lib/workspace-auth.ts:38-55`
- Returns: `AuthorizedWorkspaceResult` (workspace, member, role)
- Throws: `AppError` if not found or unauthorized

**authorizeUser (private)**
- Purpose: Check ownership or membership + permissions
- Location: `apps/dashboard/src/lib/workspace-auth.ts:102-149`
- Logic: Owner has full access; others need membership + optional permission
- Returns: Result with resolved role

**withWorkspaceAuth**
- Purpose: Decorator for routes requiring workspace auth
- Location: `apps/dashboard/src/lib/workspace-auth.ts:192-234`
- Extracts: session from headers, workspace slug from query param
- Passes: { session, auth } to handler

**ROLES Enum**
- Purpose: User roles within workspace
- Location: `apps/dashboard/src/lib/permissions.ts:25-32`
- Values: `owner`, `editor`, `viewer`, `reviewer`, `publisher`, `analyst`

**Permission Types**
- Purpose: Fine-grained action permissions
- Location: `apps/dashboard/src/lib/permissions.ts:1-21`
- Examples: `content:read`, `content:publish`, `workspace:settings`

## Usage Examples

### Example 1: Route with Workspace Membership Check

**Situation:** GET /api/posts should only return posts from user's workspace

**Implementation:**
```typescript
// apps/dashboard/src/app/api/posts/route.ts

const handler = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const workspaceSlug = url.searchParams.get("workspace");
  
  if (!workspaceSlug) {
    throw new AppError("Missing workspace param", ERROR_CODES.BAD_REQUEST);
  }
  
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);
  }
  
  const authorized = await getAuthorizedWorkspace(session, workspaceSlug);
  
  const posts = await db.query.posts.findMany({
    where: eq(posts.workspaceId, authorized.workspace.id),
  });
  
  return NextResponse.json(posts);
};

export const GET = withApiHandler(handler);
```

**Result:** Only workspace members can fetch posts; owner and members with membership both allowed

### Example 2: Route Requiring Specific Permission

**Situation:** POST /api/content/publish needs publish permission

**Implementation:**
```typescript
const handler = async (req: Request): Promise<Response> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);
  
  const url = new URL(req.url);
  const workspaceSlug = url.searchParams.get("workspace");
  
  const authorized = await getAuthorizedWorkspace(
    session,
    workspaceSlug,
    PERMISSIONS.PUBLISHING_PUBLISH // Enforce permission
  );
  
  // publish logic here
  
  return NextResponse.json({ published: true });
};

export const POST = withApiHandler(handler);
```

**Result:** Throws FORBIDDEN if user lacks publish permission

### Example 3: Audit Logging

**Situation:** Track who accessed what in workspace

**Implementation:**
```typescript
const handler = async (req: Request): Promise<Response> => {
  const authorized = await getAuthorizedWorkspace(session, slug);
  
  // Log the access
  await logWorkspaceActivity(
    authorized.workspace.id,
    session.user.id,
    "access_posts",
    "posts",
    null,
    { ip: req.headers.get("x-forwarded-for") }
  );
  
  return NextResponse.json(posts);
};
```

**Result:** Activity logged for compliance/debugging

## Edge Cases and Gotchas

### Edge Case 1: NOT_FOUND Leaks Workspace Existence

**Problem:** If workspace not found, should not reveal it exists

**Solution:** Both 404 responses return "Workspace not found" (doesn't distinguish between non-existent and unauthorized)

### Edge Case 2: Role vs Permission Mismatch

**Problem:** Member has role "viewer" but custom permissions include "content:edit"

**Solution:** `hasPermission()` checks both role permissions and custom overrides; custom perms are additive

### Edge Case 3: Owner Direct Assignment

**Problem:** Workspace.ownerId should always have full access, even if not in members table

**Solution:** `authorizeUser` checks `workspace.ownerId === session.user.id` first

## Best Practices

1. **Always require workspace param** — prevents accidental cross-workspace access
2. **Log access for audit trail** — essential for compliance
3. **Specify permission if enforcement needed** — catch unauthorized early
4. **Use getAuthorizedWorkspace for slug lookup** — single source of truth
5. **Check workspace ownership for destructive ops** — only owner can delete workspace

## Anti-Patterns

❌ **Don't:** Trust session.workspace alone
**Why:** Could be stale or belong to different workspace
**Instead:** Always look up current workspace from request param

❌ **Don't:** Skip permission checks for "just reading"
**Why:** Some reads are sensitive (billing, analytics)
**Instead:** Enforce INSIGHTS_READ for analytics, WORKSPACE_BILLING for pricing

## Testing Strategy

- Mock session with different user roles
- Test owner access (full permissions)
- Test member access (limited by role)
- Test non-member access (NOT_FOUND thrown)
- Test custom permission overrides
- Test audit log entries created

## Performance Considerations

- Workspace lookup is indexed on slug (single DB query)
- Member lookup is indexed on (workspaceId, userId) (single DB query)
- Total auth time: 2 queries, ~5-10ms typical

## Related Patterns

- [error-handling](./error-handling.md) — AppError for auth failures
- [api-route-wrapper](./api-route-wrapper.md) — error normalization

## Code References

- `apps/dashboard/src/lib/workspace-auth.ts` — all auth functions
- `apps/dashboard/src/lib/permissions.ts` — ROLES, PERMISSIONS, hasPermission
- `apps/dashboard/src/lib/db.ts` — workspace/workspaceMembers tables

## Version History

| Date | Change | Author |
|------|--------|--------|
| 2026-04-18 | Initial documentation | capture-docs |
