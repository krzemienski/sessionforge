# Neon PostgreSQL Integration

> **Category:** External Interface
> **Service:** Neon PostgreSQL
> **Last Updated:** 2026-04-18
> **Status:** Active

## Overview

**Service:** Neon PostgreSQL
**Provider:** Neon Inc.
**Purpose:** Serverless PostgreSQL database with HTTP and TCP driver support for both edge/serverless and traditional runtimes
**Documentation:** [Neon Docs](https://neon.tech/docs)

## Driver Selection

SessionForge supports **two database drivers** to accommodate different runtime environments:

### HTTP Driver: @neondatabase/serverless (v0.10)

**Use Case:** Edge runtimes (Vercel Functions, Cloudflare Workers), serverless environments
**Implementation:** `apps/dashboard/src/lib/db-adapter.ts:1-2`

```typescript
import { neon } from "@neondatabase/serverless";
import { drizzle as neonDrizzle } from "drizzle-orm/neon-http";
```

**Characteristics:**
- HTTP-based REST client — no persistent TCP connections
- Lower latency in serverless cold starts
- Compatible with edge runtimes that block TCP
- Returns responses as JSON arrays

### TCP Driver: postgres (v3.4)

**Use Case:** Local development, traditional Node.js servers, migrations
**Implementation:** `apps/dashboard/src/lib/db-adapter.ts:4-5`

```typescript
import postgres from "postgres";
import { drizzle as pgDrizzle } from "drizzle-orm/postgres-js";
```

**Characteristics:**
- TCP socket connection — persistent pooling
- Lower overhead for repeated queries in development
- Required for `drizzle-kit push` migrations
- Supports full Postgres protocol

## Driver Selection Logic

**Location:** `apps/dashboard/src/lib/db-adapter.ts:24-30`

```typescript
const databaseDriver = process.env.DATABASE_DRIVER;

function shouldUseNeon(): boolean {
  if (databaseDriver === "neon") return true;
  if (databaseDriver === "postgres") return false;
  return databaseUrl.includes("neon.tech");
}
```

**Selection Precedence:**
1. **Explicit override** — `DATABASE_DRIVER` env var (`"neon"` or `"postgres"`)
2. **Auto-detect** — If `DATABASE_URL` contains `neon.tech`, use HTTP driver
3. **Default** — Otherwise use TCP driver

## Environment Variables

### DATABASE_URL

**Format:** `postgresql://[user]:[password]@[host]/[database]`

**Examples:**
```bash
# Neon (HTTP driver will be auto-selected)
DATABASE_URL=postgresql://user:pass@proj-123.neon.tech/dbname

# Self-hosted Postgres (TCP driver will be used)
DATABASE_URL=postgresql://user:pass@localhost:5432/sessionforge
```

**Requirement:** Mandatory in production. In development, defaults to `postgresql://user:pass@localhost:5432/placeholder` if unset (unless `SF_ALLOW_DB_PLACEHOLDER=1`).

**Location:** `apps/dashboard/src/lib/db-adapter.ts:8-20`

### DATABASE_DRIVER (Optional)

**Valid Values:** `"neon"` or `"postgres"`

**Purpose:** Override automatic driver selection for testing or specific deployment scenarios.

**Location:** `apps/dashboard/src/lib/db-adapter.ts:24`

## Connection Pooling

### HTTP Driver (Neon)

- **Pooling:** Handled by Neon backend; each request is stateless
- **Concurrency:** No connection limit per request (HTTP-based)
- **Latency:** ~50-150ms per query (network round-trip + database)

### TCP Driver (postgres)

- **Pooling:** Managed by `postgres` library (default: 10 connections)
- **Concurrency:** Limited by pool size; idle timeout after 30s
- **Latency:** ~1-5ms per query (local/persistent connection)

## Neon-Specific Features Used

### Branches (Conditional)

Not actively used in current implementation. Branches available via Neon Console for copy-on-write development/staging workflows.

### Autosleep

Neon projects automatically suspend after 5 minutes of inactivity. Cold wake-up adds ~1-2 seconds on first query post-suspend. This is acceptable for the SessionForge use case.

## Migration Compatibility Notes

**Location:** `apps/dashboard/src/lib/db-adapter.ts:44-51`

```typescript
function createDb(): NeonHttpDatabase<typeof schema> {
  if (shouldUseNeon()) {
    const sql = neon(databaseUrl);
    return neonDrizzle({ client: sql, schema });
  }
  const sql = postgres(databaseUrl);
  return pgDrizzle({ client: sql, schema }) as unknown as NeonHttpDatabase<typeof schema>;
}
```

**Key Issue:** Both drivers share the Drizzle query API when constructed with `schema`, but `.returning()` generic signatures diverge. Known tech debt (noted in H5 remediation):
- **Workaround:** Cast postgres driver to `NeonHttpDatabase<typeof schema>` to unify type signatures across 15 `.returning({cols})` call sites
- **When to Fix:** Next Drizzle version bump; full union-type refactor required if `.transaction()` or other driver-specific methods are added

**Migrations:** Use TCP driver (`postgres` or `DATABASE_DRIVER=postgres`) for `drizzle-kit push`. HTTP driver cannot execute migrations.

**Command:**
```bash
DATABASE_DRIVER=postgres bun run db:push
```

## Data Integrity

### Transaction Support

- **HTTP Driver (Neon):** No transaction support (stateless HTTP)
- **TCP Driver:** Full transaction support via `db.transaction()`

Currently no transactions are used in production routes. If added, use TCP driver explicitly or refactor HTTP driver code to retry on conflict.

## Related Documentation

- **API Handler:** [api-handler.md](../patterns/api-handler.md) — Error handling wrapper using db client
- **Database Guide:** [database-guide.md](../database-guide.md) — Schema overview, querying patterns
- **Workspace Auth:** `apps/dashboard/src/lib/workspace-auth.ts` — Authorization layer above db queries
- **ADR-003:** Drizzle ORM + serverless Postgres selection rationale
- **ADR-004:** HTTP vs TCP driver trade-offs

## External Resources

- [Neon Documentation](https://neon.tech/docs)
- [Drizzle ORM - Neon](https://orm.drizzle.team/docs/get-started-postgresql#neon)
- [postgres-js Driver](https://github.com/porsager/postgres)
- [Neon Status Page](https://status.neon.tech)

## Version History

| Date | Change | Author |
|------|--------|--------|
| 2026-04-18 | Initial interface documentation | docs-manager |
| 2026-03-04 | Dual-driver support stabilized (H5 remediation) | executor |
