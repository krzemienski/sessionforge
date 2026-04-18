# Workspace Membership Domain

> **Category:** Domain Model
> **Last Updated:** 2026-04-18
> **Status:** Active

## Overview

Workspace membership defines how users are organized into teams and what permissions each user has within a workspace. Every workspace has an owner and can have multiple members with different roles.

## Roles

Each member has one of six roles, each with a predefined set of permissions:

### 1. owner

**Scope:** Full workspace access and administration

**Permissions:**
- All content operations (create, read, update, delete, publish)
- All session operations (upload, scan, delete, export)
- Member management (invite, remove, change roles)
- Workspace settings (billing, integrations, webhooks)
- API keys (create, revoke)
- Analytics and usage reporting
- Workspace deletion

**Characteristics:**
- Cannot be removed by others
- Only owner can delete workspace
- Inherent owner = workspace creator
- Can transfer ownership

**When to assign:** Team leads, organization admins

### 2. editor

**Scope:** Content creation and editing

**Permissions:**
- Create and edit content (blog, social, newsletter, etc.)
- Create and edit insights
- Read-only on sessions (cannot delete or export)
- Read analytics and pipeline status
- Use AI agents for generation
- View team members

**Restrictions:**
- Cannot publish to external platforms (unless publisher role)
- Cannot manage members or workspace settings
- Cannot view billing or API keys

**When to assign:** Content creators, writers, analysts

### 3. viewer

**Scope:** Read-only access

**Permissions:**
- Read all content
- Read all sessions and insights
- View analytics and reports
- Read-only pipeline status

**Restrictions:**
- Cannot create, edit, or delete anything
- Cannot publish content
- Cannot invite members
- Cannot access API keys

**When to assign:** Stakeholders, managers, external partners

### 4. reviewer

**Scope:** Review and approve content

**Permissions:**
- Read all content
- Add comments and feedback on content
- Approve/reject content for publishing
- View all sessions and insights
- View analytics

**Restrictions:**
- Cannot edit content directly
- Cannot publish without publisher role
- Cannot invite members
- Cannot access settings

**When to assign:** Quality assurance, content reviewers, editors-in-chief

### 5. publisher

**Scope:** Publish content to external platforms

**Permissions:**
- Read all content
- Publish content to external platforms (Hashnode, Dev.to, etc.)
- Schedule publications
- View publication history and metrics
- Read all sessions and analytics

**Restrictions:**
- Cannot create or edit content
- Cannot manage members or settings
- Cannot delete content
- Cannot access API keys

**When to assign:** Publishing managers, growth marketers

### 6. analyst

**Scope:** Analytics and reporting access

**Permissions:**
- Read all analytics and reports
- Read all sessions and insights
- Export data and reports
- View usage metrics
- View audience engagement data

**Restrictions:**
- Cannot create, edit, or delete content
- Cannot publish content
- Cannot manage members
- Cannot access API keys or settings

**When to assign:** Data analysts, business intelligence team

## Permission Matrix

| Action | Owner | Editor | Viewer | Reviewer | Publisher | Analyst |
|--------|-------|--------|--------|----------|-----------|---------|
| Create Content | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Edit Content | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Delete Content | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Publish Content | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ |
| Read Content | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Review/Approve | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ |
| Upload Sessions | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Read Sessions | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Export Sessions | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Invite Members | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Change Roles | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| View Analytics | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Manage Billing | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Manage Settings | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Access API Keys | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |

## Database Model

```typescript
export const workspaceMemberRoleEnum = pgEnum("workspace_member_role", [
  "owner",
  "editor",
  "viewer",
  "reviewer",
  "publisher",
  "analyst",
]);

// Used in workspaceMembers table:
{
  workspaceId: string;
  userId: string;
  role: typeof workspaceMemberRoleEnum.enumValues[number];
  joinedAt: Date;
  invitedBy: string;
}
```

## Membership Workflow

### Inviting Members

1. Owner clicks "Invite Member" in workspace settings
2. Enters email and selects role
3. Email sent with invitation link
4. User accepts invitation or creates account
5. Member added to workspace with selected role

### Changing Roles

1. Owner navigates to member management
2. Selects member and new role
3. Permission update immediate
4. Member receives notification of change

### Removing Members

1. Owner selects member to remove
2. Confirms removal
3. Member access revoked immediately
4. Member notified of removal

## Authorization Enforcement

Every workspace-scoped operation validates:

```typescript
// Pseudocode
function authorizeAction(userId, workspaceId, requiredPermission) {
  const membership = getMembership(userId, workspaceId);
  if (!membership) throw UNAUTHORIZED;
  
  const role = membership.role;
  if (!hasPermission(role, requiredPermission)) throw FORBIDDEN;
  
  return true; // Authorized
}
```

See [Patterns: Workspace Authorization](../patterns/workspace-auth.md) for implementation details.

## Default Workspace Creation

When a user signs up:
1. A workspace is auto-created (workspace_name = user's name or email)
2. User is auto-assigned as `owner` of the workspace
3. Workspace becomes user's default workspace

## Constraints

1. **Single Owner per Workspace** — Workspace must always have exactly one owner
2. **Owner Cannot Be Removed** — Owner role cannot be revoked from the owner
3. **Ownership Transfer Only** — To remove owner, must transfer ownership first
4. **Email Unique per Workspace** — Same user cannot be invited twice to same workspace
5. **Role-Based Not User-Based** — Permissions derived from role, not individual user settings

## Best Practices

1. **Principle of Least Privilege** — Assign minimum required role
2. **Regular Audits** — Review membership and roles quarterly
3. **Separation of Duties** — Don't combine publishing + approval in single user
4. **Owner Redundancy** — Consider training second admin as backup
5. **Revoke Promptly** — Remove members when they leave organization

## Related Documentation

- [Domain: Content Types](./content-types.md) — what members create
- [Patterns: Workspace Authorization](../patterns/workspace-auth.md) — how permissions enforced
- [Patterns: API Route Wrapper](../patterns/api-route-wrapper.md) — auth enforcement in routes

## Version History

| Date | Change | Author |
|------|--------|--------|
| 2026-04-18 | Initial domain model | capture-docs |
