# Phase 2: Docker Hardening - Research

**Researched:** 2026-03-23
**Domain:** Docker containerization, Next.js standalone, Drizzle ORM migrations, monorepo builds
**Confidence:** HIGH

## Summary

Phase 2 transforms the existing Docker setup from a "builds but doesn't fully work" state to a zero-step `docker compose up` experience. The current Dockerfile is a functional 3-stage build (deps/build/runner) but has five concrete defects: wrong base image (node:20-slim, not 22), no auto-migration on startup, no entrypoint script, sharp may fail in runner (no explicit dependency handling), and CLAUDECODE env var not cleared. The dev `docker-compose.yml` is missing critical env vars (`DATABASE_DRIVER`, `BETTER_AUTH_URL`) that the self-hosted compose already has.

The single largest gap is that `packages/db/src/migrate.ts` does not exist -- it is referenced in `packages/db/package.json` scripts (`db:migrate`) but was never created. This script must be authored using `drizzle-orm/postgres-js/migrator` with a `postgres` npm dependency added to the db package. A `docker-entrypoint.sh` script must also be created to run migrations before starting the Node.js server.

**Primary recommendation:** Fix the 5 Dockerfile defects, create the migration runner, write the entrypoint script, align docker-compose.yml env vars with the self-hosted compose, and update .env.example to match Docker dev usage.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Use generated migration files (not drizzle-kit push) for auto-migration -- drizzle-kit push is interactive and hangs on prompts for new enums/columns. The entrypoint script runs `bun run src/migrate.ts` from the db package before starting the app server.
- D-02: Entrypoint script pattern -- a shell script (`docker-entrypoint.sh`) runs migrations then exec's the node server.
- D-03: Upgrade from node:20-slim to node:22-slim (per DOCK-06 requirement). Node 22 is the current LTS.
- D-04: Install sharp's native dependencies (libvips) in the runner stage.
- D-05: Clear CLAUDECODE env var in the Dockerfile runner stage (`ENV CLAUDECODE=`).
- D-06: Keep `docker-compose.yml` as the primary dev compose file (DOCK-01 target). Keep `docker-compose.self-hosted.yml` for production. Remove or rename `docker-compose.prod.yml` if redundant.
- D-07: Redis stays optional in dev compose -- app already has graceful Redis fallback.
- D-08: Docker compose sets `DATABASE_DRIVER=postgres` explicitly.
- D-09: `.env.example` must document every required env var with clear categories.

### Claude's Discretion
- Exact entrypoint script structure (bash vs sh, error handling approach)
- Whether to use `--force` on drizzle-kit push if migration files approach doesn't work
- Build cache optimization in Dockerfile (layer ordering, .dockerignore)
- Whether to add a `.dockerignore` file (recommended for build performance)
- Health check timing parameters (intervals, retries, start period)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DOCK-01 | User can run `docker compose up` from a clean clone and get the full app with local Postgres | Requires: entrypoint script with auto-migration, correct env vars in compose, Dockerfile fixes |
| DOCK-02 | User can see Postgres schema auto-migrated on first compose up (no manual db:push) | Requires: create `packages/db/src/migrate.ts` using `drizzle-orm/postgres-js/migrator`, add `postgres` dep to db package, entrypoint runs migration before app start |
| DOCK-03 | User can access the app at localhost:3000 with data from local Postgres | Requires: `DATABASE_DRIVER=postgres` in compose, `BETTER_AUTH_URL` set, standalone output serves correctly |
| DOCK-04 | User can see all containers pass healthchecks (app + postgres) | Requires: fix healthcheck Redis detection bug (line 30 only checks UPSTASH_REDIS_URL), tune timing params |
| DOCK-05 | User can build the Docker image independently with `docker build` | Requires: Dockerfile self-contained with all 3 stages working, .dockerignore optimization |
| DOCK-06 | User can see node:22-slim runner image, sharp installed, CLAUDECODE env cleared | Requires: base image upgrade, sharp binary handling, `ENV CLAUDECODE=` |
| DOCK-07 | User can see .env.example documents every required environment variable | Requires: align .env.example with Docker dev usage, categorize required vs optional |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **No mocks/tests**: NEVER write test files, mocks, or stubs -- validate through real system
- **Agent SDK auth**: Claude Agent SDK inherits from CLI -- no ANTHROPIC_API_KEY env vars
- **Container portability**: No provider-specific code inside containers -- all specifics in env vars
- **Schema parity**: Local Docker Postgres must use identical schema to Neon production
- **Dev server**: Use `next dev` (NOT --turbopack) -- but this is for dev, not Docker
- **Functional validation**: Build and run the real system to validate

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| drizzle-orm | ^0.39 | ORM and migration runner | In both packages |
| postgres (postgres.js) | ^3.4.8 | Standard Postgres driver | In dashboard, **MISSING from db package** |
| @neondatabase/serverless | ^0.10 | Neon HTTP driver (Vercel) | In both packages |
| drizzle-kit | ^0.30 | Schema generation/push | In db package (devDep) |
| sharp | ^0.34.5 | Image processing (next/image) | In dashboard |

### Docker Images
| Image | Version | Purpose | Why |
|-------|---------|---------|-----|
| oven/bun:1.2.4-slim | 1.2.4 | Deps + build stages | Bun is the project package manager |
| node:22-slim | 22.x LTS | Runner stage | Lightweight, current LTS (upgrade from node:20-slim) |
| postgres:16-alpine | 16 | Database | Already in compose files |

### Migration Runner Dependency (Must Add)
```bash
cd packages/db && bun add postgres
```

The `postgres` npm package must be added to `packages/db/package.json` as a production dependency because the migration runner (`migrate.ts`) needs it to connect to Postgres directly.

## Architecture Patterns

### Current Dockerfile Structure (3-Stage)
```
Stage 1: deps     (oven/bun:1.2.4-slim) - install dependencies
Stage 2: builder  (oven/bun:1.2.4-slim) - build Next.js
Stage 3: runner   (node:20-slim -> node:22-slim) - serve app
```

### Required Changes to Dockerfile

**Base image upgrade (D-03):**
```dockerfile
FROM node:22-slim AS runner
```

**CLAUDECODE env clear (D-05):**
```dockerfile
ENV CLAUDECODE=""
```

**Sharp handling (D-04):**
Sharp ^0.34 on node:22-slim (Debian bookworm) downloads prebuilt binaries automatically during `npm install`. The runner stage uses standalone output which includes traced dependencies. If sharp binaries are not traced correctly by Next.js, the fallback is to install sharp globally in the runner stage:
```dockerfile
# In runner stage, before USER nextjs
RUN npm install -g sharp@0.34.5
ENV NEXT_SHARP_PATH=/usr/local/lib/node_modules/sharp
```

However, since sharp is a direct dependency and Next.js standalone output traces it, the prebuilt binary should already be included in `.next/standalone/node_modules/sharp/`. Verify this during implementation before adding the global install fallback.

**Entrypoint script (D-02):**
```dockerfile
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
# Must be before USER nextjs if using root for chmod
RUN chmod +x /app/docker-entrypoint.sh
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "apps/dashboard/server.js"]
```

**Migration files must be copied to runner:**
The standalone output does NOT include `packages/db/migrations/`. These must be explicitly copied:
```dockerfile
COPY --from=builder /app/packages/db/migrations ./packages/db/migrations
```

The migration runner also needs `postgres` and `drizzle-orm` available in the runner stage. Since standalone traces dependencies used by the app, and the app uses both, they should be in `node_modules`. But `migrate.ts` is a separate script -- its dependencies need to be available too. The entrypoint must either:
1. Use the node_modules from standalone output (if postgres-js is traced), OR
2. Copy the db package's node_modules separately

### Entrypoint Script Pattern

```bash
#!/bin/sh
set -e

echo "[entrypoint] Running database migrations..."
cd /app/packages/db
node -e "
  const postgres = require('postgres');
  const { drizzle } = require('drizzle-orm/postgres-js');
  const { migrate } = require('drizzle-orm/postgres-js/migrator');
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  const db = drizzle(sql);
  migrate(db, { migrationsFolder: '/app/packages/db/migrations' })
    .then(() => { console.log('[entrypoint] Migrations complete'); sql.end(); })
    .catch((err) => { console.error('[entrypoint] Migration failed:', err); process.exit(1); });
"

echo "[entrypoint] Starting application..."
exec "$@"
```

**Recommendation:** Use `sh` (not `bash`) since node:22-slim has `/bin/sh` but may not have `/bin/bash`. Use inline Node.js for the migration call rather than requiring bun or ts-node in the runner image. This avoids adding bun to the runner stage.

**Alternative (recommended):** Create `packages/db/src/migrate.ts` as a proper TypeScript file that gets compiled during build, then copy the compiled output to the runner. But this requires adding a build step to the db package. The simpler path is an inline Node.js script in the entrypoint that uses the CommonJS modules already present in standalone node_modules.

### Migration Runner Script (packages/db/src/migrate.ts)

Even though the entrypoint may use inline Node.js, creating this file fulfills the `db:migrate` script in package.json and enables local migration testing:

```typescript
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1 });
const db = drizzle(sql);

console.log("[migrate] Running migrations...");
await migrate(db, { migrationsFolder: "./migrations" });
console.log("[migrate] Migrations complete");
await sql.end();
```

**Key API detail (verified from official docs):**
- Import: `import { migrate } from "drizzle-orm/postgres-js/migrator"`
- Requires `max: 1` on the postgres connection
- `migrationsFolder` points to the directory containing `.sql` files and `meta/` journal
- The function returns a Promise -- must await it
- After migration, close the connection with `sql.end()`

### docker-compose.yml Alignment

Current dev compose is MISSING these critical env vars (present in self-hosted):
```yaml
environment:
  DATABASE_DRIVER: "postgres"           # MISSING - required for postgres-js driver
  BETTER_AUTH_URL: "http://localhost:3000"  # MISSING - required for auth
```

### Recommended Project Structure for New Files
```
/
├── Dockerfile                    # MODIFY: 5 fixes
├── docker-entrypoint.sh          # CREATE: migration + exec
├── docker-compose.yml            # MODIFY: add missing env vars
├── docker-compose.self-hosted.yml # NO CHANGE (already good)
├── docker-compose.prod.yml       # REVIEW: remove if redundant
├── .dockerignore                 # MODIFY: verify completeness
├── .env.example                  # REWRITE: align with Docker dev
├── packages/db/
│   ├── package.json              # MODIFY: add postgres dependency
│   ├── src/
│   │   ├── migrate.ts            # CREATE: migration runner
│   │   ├── schema.ts             # NO CHANGE
│   │   └── index.ts              # NO CHANGE
│   └── migrations/
│       ├── 0000_slimy_edwin_jarvis.sql  # EXISTS (80KB, full schema)
│       └── meta/
│           ├── _journal.json     # EXISTS
│           └── 0000_snapshot.json # EXISTS
```

### Anti-Patterns to Avoid
- **Running drizzle-kit push in Docker entrypoint:** Interactive prompts hang the container. Use migration files only (D-01).
- **Installing bun in the runner stage:** Adds ~200MB to the image. Use node directly for migrations.
- **Relying on ts-node in production:** The runner stage has no TypeScript compiler. Use inline JS or pre-compiled output.
- **Skipping `sql.end()` after migration:** The postgres-js connection pool keeps the process alive indefinitely.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Database migrations | Custom SQL execution scripts | `drizzle-orm/postgres-js/migrator` `migrate()` | Handles migration journaling, idempotency, ordering, rollback tracking |
| Driver switching | Manual connection string parsing | `db-adapter.ts` `DATABASE_DRIVER` env var | Already built, handles Neon vs postgres-js |
| Health checking | Custom TCP probes | `/api/healthcheck` route + Docker HEALTHCHECK | Already exists, checks DB + Redis |
| Entrypoint orchestration | Complex bash with retry loops | Simple `set -e` + migrate + exec | Postgres healthcheck ensures DB is ready before app starts |

## Common Pitfalls

### Pitfall 1: Migration runner missing postgres dependency
**What goes wrong:** `packages/db/src/migrate.ts` imports `postgres` but it's not in `packages/db/package.json` dependencies. In the monorepo, bun hoists it from dashboard's deps, so it works locally. But when building the standalone Docker output, the dependency is NOT traced because `migrate.ts` is not imported by the Next.js app.
**Why it happens:** Bun workspace hoisting masks missing direct dependencies.
**How to avoid:** Add `postgres` as a direct dependency to `packages/db/package.json`.
**Warning signs:** `Cannot find module 'postgres'` errors in Docker container startup.

### Pitfall 2: Standalone output doesn't include migration files
**What goes wrong:** Next.js standalone output traces only runtime imports. The `migrations/` directory is static SQL files not imported by any code -- they are never traced.
**Why it happens:** Next.js `output: "standalone"` uses webpack/turbopack analysis to determine what to include.
**How to avoid:** Explicitly `COPY --from=builder /app/packages/db/migrations ./packages/db/migrations` in the Dockerfile runner stage.
**Warning signs:** `ENOENT: no such file or directory` when migration runs in container.

### Pitfall 3: Healthcheck Redis detection bug
**What goes wrong:** The `/api/healthcheck` route (line 30) checks `!!process.env.UPSTASH_REDIS_URL` to determine if Redis is "configured". In Docker with `REDIS_URL` (not Upstash), this returns false. So if Redis crashes, healthcheck still reports "ok" instead of "degraded".
**Why it happens:** The healthcheck was written for Vercel/Upstash deployment, not self-hosted Redis.
**How to avoid:** Fix line 30 to also check `REDIS_URL`: `const redisConfigured = !!process.env.UPSTASH_REDIS_URL || !!process.env.REDIS_URL;` (matching what `/api/deployment/validate` already does correctly on lines 74-76).
**Warning signs:** Healthcheck shows `redis: false` but `status: "ok"` when Redis is configured via `REDIS_URL`.

### Pitfall 4: Entrypoint migration runs before Postgres is ready
**What goes wrong:** The migration script connects to Postgres before it has finished initializing.
**Why it happens:** `docker compose up` starts containers concurrently.
**How to avoid:** Use `depends_on: postgres: condition: service_healthy` in docker-compose.yml (ALREADY correctly configured in current compose). The Postgres healthcheck uses `pg_isready` which confirms the DB is accepting connections.
**Warning signs:** `ECONNREFUSED` errors in migration script. NOT a problem here because the compose already handles this.

### Pitfall 5: docker-compose.prod.yml confusion
**What goes wrong:** Users don't know which compose file to use. Three compose files with overlapping purpose causes confusion.
**Why it happens:** `docker-compose.prod.yml` was created alongside `docker-compose.self-hosted.yml` but serves a similar role.
**How to avoid:** Per D-06, review and remove `docker-compose.prod.yml` if it duplicates self-hosted. The prod file currently only has the app service (no postgres, no redis) -- it's a Vercel-style deployment that pulls env vars from the host. This is different enough to keep but should be clearly documented or renamed.
**Warning signs:** User confusion about which file to use.

### Pitfall 6: CLAUDECODE env var in production containers
**What goes wrong:** If a container inherits the CLAUDECODE env var from a parent Claude Code session (e.g., during testing), the Agent SDK's `query()` function fails with exit code 1 (nested session rejection).
**Why it happens:** The env var propagates through Docker build contexts or runtime environments.
**How to avoid:** Set `ENV CLAUDECODE=""` in the Dockerfile runner stage (D-05). The 12 source files also have `delete process.env.CLAUDECODE` as defense-in-depth.
**Warning signs:** AI agent routes return 500 errors with "exit code 1" in logs.

## Code Examples

### Drizzle postgres-js Migration API (verified)
```typescript
// Source: https://github.com/drizzle-team/drizzle-orm/blob/main/drizzle-orm/src/postgres-js/README.md
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

// CRITICAL: max: 1 is required for migrations
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(sql);

await migrate(db, { migrationsFolder: "./migrations" });
await sql.end(); // MUST close or process hangs
```

### Next.js Standalone Dockerfile Runner Stage (verified)
```dockerfile
# Source: https://github.com/vercel/next.js/tree/canary/examples/with-docker
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy standalone output
COPY --from=builder --chown=node:node /app/apps/dashboard/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/dashboard/.next/static ./apps/dashboard/.next/static
COPY --from=builder --chown=node:node /app/apps/dashboard/public ./apps/dashboard/public

# Copy migration files (not traced by standalone)
COPY --from=builder /app/packages/db/migrations ./packages/db/migrations

USER node
EXPOSE 3000
CMD ["node", "apps/dashboard/server.js"]
```

### Docker Healthcheck (current + fix)
```dockerfile
# Current (works):
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/healthcheck').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"
```

### Entrypoint Script Pattern
```bash
#!/bin/sh
set -e

echo "[docker-entrypoint] Running database migrations..."
# Use node directly (no bun/ts-node in runner image)
# postgres and drizzle-orm are in standalone node_modules
node -e "
const postgres = require('postgres');
const { drizzle } = require('drizzle-orm/postgres-js');
const { migrate } = require('drizzle-orm/postgres-js/migrator');
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const db = drizzle(sql);
migrate(db, { migrationsFolder: '/app/packages/db/migrations' })
  .then(() => { console.log('[docker-entrypoint] Migrations applied successfully'); return sql.end(); })
  .catch((err) => { console.error('[docker-entrypoint] Migration failed:', err); process.exit(1); });
"

echo "[docker-entrypoint] Starting application..."
exec "$@"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `drizzle-kit push` (interactive) | `migrate()` from migration files | Drizzle ORM 0.29+ | Non-interactive, CI/Docker safe |
| node:20-slim | node:22-slim | Node 22 LTS Oct 2024 | Security updates, performance |
| Manual schema setup | Auto-migration in entrypoint | This phase | Zero-step experience |

## Open Questions

1. **Sharp in standalone output**
   - What we know: Sharp is a dependency of the dashboard, and Next.js standalone traces runtime deps. Sharp ^0.34 provides prebuilt binaries for linux/x64 glibc.
   - What's unclear: Whether the standalone trace correctly includes sharp's native binaries (.node files). If not, the global install fallback is needed.
   - Recommendation: During implementation, check if `apps/dashboard/.next/standalone/node_modules/sharp` exists after build. If not, add global sharp install to runner stage.

2. **Migration script execution method**
   - What we know: The runner stage has Node.js but NOT bun or ts-node. The `migrate.ts` file uses ESM imports.
   - What's unclear: Whether standalone node_modules includes postgres-js and drizzle-orm in CommonJS format accessible via `require()`.
   - Recommendation: Test with inline Node.js `require()` first. If modules aren't available, copy `packages/db/node_modules` to the runner stage explicitly. Alternative: compile migrate.ts during build and copy the JS output.

3. **docker-compose.prod.yml disposition**
   - What we know: It has only the app service (no DB/Redis) and pulls all env vars from host. Different purpose from self-hosted.
   - What's unclear: Whether any documentation or CI references it.
   - Recommendation: Keep it but rename to `docker-compose.cloud.yml` or add a comment header explaining its purpose. Low priority -- does not affect DOCK-01 through DOCK-07.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker | Build + runtime | Yes | 29.2.1 | -- |
| Docker Compose | `docker compose up` | Yes | v5.1.0 | -- |
| Bun | Package install + build stages | Yes | 1.3.6 | -- |
| Node.js | Runner stage (inside container) | Yes (host: v25.8.1, container: 22.x) | -- | -- |
| PostgreSQL | Database (in container) | Via postgres:16-alpine image | 16.x | -- |

**Missing dependencies with no fallback:** None -- all required tools are available.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual functional validation (project mandate: no test files) |
| Config file | N/A |
| Quick run command | `docker compose up --build` then `curl http://localhost:3000/api/healthcheck` |
| Full suite command | `docker compose up --build -d && docker compose ps && curl -s http://localhost:3000/api/healthcheck \| jq . && curl -s http://localhost:3000/api/deployment/validate \| jq .` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DOCK-01 | docker compose up works from clean clone | smoke | `docker compose down -v && docker compose up --build -d && sleep 15 && curl -sf http://localhost:3000/api/healthcheck` | N/A (manual) |
| DOCK-02 | Schema auto-migrated on first startup | smoke | `docker compose logs app \| grep "Migrations applied"` | N/A (manual) |
| DOCK-03 | App accessible at localhost:3000 | smoke | `curl -sf http://localhost:3000` | N/A (manual) |
| DOCK-04 | All containers pass healthchecks | smoke | `docker compose ps --format json \| jq '.[] \| .Health'` | N/A (manual) |
| DOCK-05 | Docker image builds independently | smoke | `docker build -t sessionforge:test .` | N/A (manual) |
| DOCK-06 | node:22-slim, sharp, CLAUDECODE cleared | inspection | `docker run --rm sessionforge:test node -e "console.log(process.version, process.env.CLAUDECODE)"` + `docker run --rm sessionforge:test node -e "require('sharp')"` | N/A (manual) |
| DOCK-07 | .env.example documents all vars | review | Manual file review | N/A (manual) |

### Sampling Rate
- **Per task commit:** `docker build -t sessionforge:test .` (verify image builds)
- **Per wave merge:** Full `docker compose up` + healthcheck + deployment/validate
- **Phase gate:** All 7 DOCK requirements verified via real Docker execution

### Wave 0 Gaps
- None -- validation is functional (docker compose up + curl), not test-framework based

## Sources

### Primary (HIGH confidence)
- Codebase files: Dockerfile, docker-compose.yml, docker-compose.self-hosted.yml, db-adapter.ts, healthcheck/route.ts, redis.ts, packages/db/package.json
- [Drizzle ORM postgres-js README](https://github.com/drizzle-team/drizzle-orm/blob/main/drizzle-orm/src/postgres-js/README.md) -- migration API verified
- [Next.js Deploying docs](https://nextjs.org/docs/app/getting-started/deploying) -- standalone Docker pattern verified
- [Next.js with-docker example](https://github.com/vercel/next.js/tree/canary/examples/with-docker) -- official Dockerfile reference

### Secondary (MEDIUM confidence)
- [Sharp installation docs](https://sharp.pixelplumbing.com/install/) -- prebuilt binary behavior on glibc Linux
- [Flinect blog: Next.js standalone Docker sharp](https://flinect.com/blog/nextjs-standalone-docker-sharp-installation) -- NEXT_SHARP_PATH fallback pattern

### Tertiary (LOW confidence)
- None -- all critical claims verified against official sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in project, versions verified from package.json
- Architecture: HIGH -- existing Dockerfile and compose files examined line-by-line, defects catalogued
- Pitfalls: HIGH -- each pitfall verified against actual source code (e.g., healthcheck bug confirmed at line 30)
- Migration API: HIGH -- verified against official Drizzle ORM docs and README

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (stable domain -- Docker, Drizzle, Next.js standalone patterns don't change frequently)
