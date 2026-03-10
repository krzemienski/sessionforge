# SessionForge Database Guide

**Version:** 0.5.1-alpha

---

## Overview

SessionForge uses **PostgreSQL** hosted on [Neon](https://neon.tech/) (serverless), accessed through **Drizzle ORM** with the `@neondatabase/serverless` driver.

- **Schema file:** `packages/db/src/schema.ts`
- **DB client:** `apps/dashboard/src/lib/db.ts` (singleton Drizzle instance)
- **Package import:** `import { posts, workspaces } from "@sessionforge/db"`

```typescript
// apps/dashboard/src/lib/db.ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@sessionforge/db";

const sql = neon(process.env.DATABASE_URL ?? "postgresql://...");
export const db = drizzle({ client: sql, schema });
```

---

## Table Inventory

### Auth (4 tables)

| Table | Purpose |
|---|---|
| `users` | User accounts (id, name, email, onboarding status) |
| `auth_sessions` | Active login sessions with token, expiry, active workspace |
| `accounts` | OAuth provider accounts (GitHub, etc.) linked to users |
| `verifications` | Email verification and password reset tokens |

### Workspaces (5 tables)

| Table | Purpose |
|---|---|
| `workspaces` | Workspace containers (name, slug, owner, session base path) |
| `workspace_members` | Team membership with roles (owner, editor, viewer) |
| `workspace_invites` | Pending workspace invitations with token and expiry |
| `workspace_activity` | Audit log of workspace actions |
| `style_settings` | Per-workspace content style config (tone, audience, word count) |

### Session Scanning (3 tables)

| Table | Purpose |
|---|---|
| `claude_sessions` | Indexed Claude Code sessions (messages, tools, files, cost) |
| `session_bookmarks` | User-marked session highlights for insight extraction |
| `scan_sources` | SSH remote scan source configs (host, credentials, base path) |

### Content (8 tables)

| Table | Purpose |
|---|---|
| `posts` | All content items (blog posts, tweets, LinkedIn posts, changelogs, newsletters) |
| `post_revisions` | Version history with content snapshots and diffs |
| `post_conversations` | Chat history between user and AI editor per post |
| `series` | Ordered content series (e.g., multi-part tutorials) |
| `series_posts` | Junction table linking posts to series with ordering |
| `collections` | Themed content collections with optional custom domain |
| `collection_posts` | Junction table linking posts to collections |
| `content_templates` | Built-in and custom content templates |

### AI and Agents (4 tables)

| Table | Purpose |
|---|---|
| `insights` | Extracted insights with 6-dimension composite scoring |
| `writing_style_profiles` | Learned writing style (voice, tone, vocabulary, examples) |
| `agent_runs` | Agent execution tracking (type, status, attempts, errors) |
| `agent_events` | Observability events for agent trace/span visualization |
| `writing_skills` | Custom writing instructions loaded from workspace files |

### Automation (3 tables)

| Table | Purpose |
|---|---|
| `content_triggers` | Scheduled/manual/file-watch content generation triggers |
| `automation_runs` | Pipeline run tracking (scanning -> extracting -> generating -> complete) |
| `batch_jobs` | Bulk operations (batch extract, batch generate, batch archive) |

### Integrations -- Publishing (8 tables)

| Table | Purpose |
|---|---|
| `integration_settings` | Hashnode API token and publication config |
| `devto_integrations` | Dev.to API key and username |
| `devto_publications` | Published Dev.to articles linked to posts |
| `ghost_integrations` | Ghost CMS URL and Admin API key |
| `ghost_publications` | Published Ghost posts linked to posts |
| `medium_integrations` | Medium access token and user ID |
| `medium_publications` | Published Medium articles linked to posts |
| `wordpress_connections` | WordPress site URL and app password |

### Integrations -- Social and GitHub (9 tables)

| Table | Purpose |
|---|---|
| `twitter_integrations` | Twitter/X OAuth tokens per workspace |
| `twitter_publications` | Published tweets linked to posts |
| `linkedin_integrations` | LinkedIn OAuth tokens per workspace |
| `linkedin_publications` | Published LinkedIn posts linked to posts |
| `github_integrations` | GitHub OAuth access tokens per workspace |
| `github_repositories` | Synced GitHub repos |
| `github_commits` | Synced commit history |
| `github_pull_requests` | Synced PR data |
| `github_issues` | Synced issue data |
| `github_privacy_settings` | Per-repo/commit content exclusion flags |

### Analytics and Performance (5 tables)

| Table | Purpose |
|---|---|
| `content_metrics` | Cross-platform content metrics (views, reactions, comments) |
| `platform_settings` | Dev.to/Hashnode API keys for metrics fetching |
| `post_performance_metrics` | Per-post engagement data by platform |
| `engagement_metrics` | Aggregated engagement rates per post |
| `social_analytics` | Twitter/LinkedIn analytics snapshots |

### Content Intelligence (3 tables)

| Table | Purpose |
|---|---|
| `content_recommendations` | AI-generated topic, format, and timing recommendations |
| `recommendation_feedback` | User accept/dismiss feedback on recommendations |
| `scheduled_publications` | Publish queue with QStash schedule IDs |

### Billing (3 tables)

| Table | Purpose |
|---|---|
| `subscriptions` | Stripe subscription state (plan tier, status, period) |
| `usage_events` | Individual usage events (scans, extractions, generations) |
| `usage_monthly_summary` | Aggregated monthly usage and cost |

### Other (2 tables)

| Table | Purpose |
|---|---|
| `api_keys` | Workspace API keys (hashed, with prefix for display) |
| `webhook_endpoints` | Workspace webhook configs (URL, events, secret) |

---

## Key Enums

| Enum | Values |
|---|---|
| `post_status` | `draft`, `published`, `archived`, `idea`, `in_review`, `scheduled` |
| `content_type` | `blog_post`, `twitter_thread`, `linkedin_post`, `devto_post`, `changelog`, `newsletter`, `custom` |
| `insight_category` | `novel_problem_solving`, `tool_pattern_discovery`, `before_after_transformation`, `failure_recovery`, `architecture_decision`, `performance_optimization` |
| `trigger_type` | `manual`, `scheduled`, `file_watch` |
| `agent_type` | `insight-extractor`, `blog-writer`, `social-writer`, `changelog-writer`, `editor-chat` |
| `automation_run_status` | `pending`, `scanning`, `extracting`, `generating`, `complete`, `failed` |
| `lookback_window` | `current_day`, `yesterday`, `last_7_days`, `last_14_days`, `last_30_days`, `all_time`, `custom` |
| `plan_tier` | `free`, `solo`, `pro`, `team` |
| `workspace_member_role` | `owner`, `editor`, `viewer` |
| `tone_profile` | `technical`, `tutorial`, `conversational`, `professional`, `casual` |

---

## Key Relations

### Core Data Flow

```
users → workspaces → claude_sessions → insights → posts → publications
                  ↘ content_triggers → automation_runs ↗
```

- Every table is scoped to `workspaceId` (workspace-level isolation)
- `claude_sessions` yield `insights` via AI extraction
- `insights` generate `posts` via AI writing agents
- `posts` link to platform-specific publication records
- `content_triggers` drive `automation_runs` which produce posts

### Post Publication Chain

A single `post` can be published to multiple platforms simultaneously:

```
post ←→ devto_publications    (1:1)
post ←→ ghost_publications    (1:1)
post ←→ medium_publications   (1:1)
post ←→ twitter_publications  (1:1)
post ←→ linkedin_publications (1:1)
post ←→ wordpress (via wordpress_connections + wordpressPostId on posts)
post ←→ hashnode (via hashnodeUrl on posts)
```

### Content Organization

```
series ←→ series_posts ←→ posts   (ordered, 1 post per series)
collections ←→ collection_posts ←→ posts  (ordered, many-to-many)
```

---

## Common Query Patterns

See [code-standards.md](./code-standards.md) for full conventions.

```typescript
import { db } from "@/lib/db";
import { posts, insights, claudeSessions } from "@sessionforge/db";
import { eq, and, desc } from "drizzle-orm";

// Find with relations
const post = await db.query.posts.findFirst({
  where: eq(posts.id, id),
  with: { workspace: true, insight: true, revisions: true },
});

// Paginated list
const items = await db.query.posts.findMany({
  where: eq(posts.workspaceId, wsId),
  orderBy: [desc(posts.createdAt)],
  limit: 20,
  offset: 0,
});

// Upsert (idempotent scan)
await db.insert(claudeSessions)
  .values(record)
  .onConflictDoUpdate({
    target: [claudeSessions.workspaceId, claudeSessions.sessionId],
    set: { ...updates },
  });
```

---

## Migration Workflow

SessionForge uses `drizzle-kit` for schema management.

### Push (Development)

Applies schema changes directly to the database without generating migration files:

```bash
cd apps/dashboard
bunx drizzle-kit push
```

### Generate (Production)

Generates SQL migration files for review before applying:

```bash
cd apps/dashboard
bunx drizzle-kit generate
```

### Known Issues

- `drizzle-kit push` may hang on interactive prompts when adding new enums or columns. Use direct `ALTER TABLE` SQL as a workaround.
- Always verify the live database schema matches the Drizzle schema after migrations -- tables and columns may be missing from the live DB even if defined in code.
- After schema changes, restart the dev server to avoid stale Turbopack/Next.js cache errors.

---

## Design Principles

1. **Workspace-scoped everything** -- all content tables reference `workspaceId` with `ON DELETE CASCADE`
2. **Idempotent scanning** -- `(workspaceId, sessionId)` unique constraint on `claude_sessions` enables safe re-scans
3. **Soft references for optional relations** -- `insightId` on posts is nullable; posts can exist without insights
4. **Per-platform publication tables** -- each integration has its own credentials table + publications table
5. **Composite scoring** -- insights use 6 scoring dimensions for ranking, not just recency
6. **Audit trail** -- `workspace_activity` logs actions, `post_revisions` tracks content changes

---

**Last Updated:** March 2026
