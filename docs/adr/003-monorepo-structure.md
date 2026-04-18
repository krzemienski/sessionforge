# ADR 003: Monorepo Structure (Turborepo + Bun + Workspace Packages)

**Date:** 2026-04-18
**Status:** Accepted
**Deciders:** Nick (Engineering Lead)

---

## Context

SessionForge started as a single-app project but needs:

1. **Shared database layer** — Drizzle schema, migrations, types consumed by dashboard app, future CLI tooling, and scripts
2. **Fast cold installs** — Vercel CI/CD builds spend ~2 min on `npm install` on a monorepo
3. **Task orchestration** — Build dependencies (build `packages/db` before `apps/dashboard`)
4. **Single language runtime** — TypeScript everywhere; no polyglot infrastructure

---

## Decision

**Structure as a Turborepo monorepo with Bun as the package manager and Node runtime.**

### Layout

```
sessionforge/
├── package.json                         # Root workspaces declaration + root scripts
├── turbo.json                          # Task graph configuration
│
├── apps/
│   └── dashboard/                      # Next.js 15 app (@sessionforge/dashboard)
│       ├── src/
│       ├── public/
│       ├── package.json                # App-specific deps
│       └── next.config.ts
│
├── packages/
│   ├── db/                            # Shared database (@sessionforge/db)
│   │   ├── src/
│   │   │   ├── schema/               # Split schema (Wave 4b)
│   │   │   │   ├── tables.ts        # 75 pgTable definitions
│   │   │   │   ├── enums.ts
│   │   │   │   ├── types.ts
│   │   │   │   └── relations.ts
│   │   │   ├── schema.ts             # Barrel: re-exports all schema
│   │   │   └── index.ts              # Package exports
│   │   ├── migrations/               # Drizzle migrations (SQL + snapshots)
│   │   └── package.json
│   └── tsconfig/                      # Shared TypeScript config
│       └── package.json
│
└── .env.example
```

### Root package.json

```json
{
  "name": "sessionforge",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "build": "turbo build",
    "dev": "turbo dev",
    "lint": "turbo lint"
  },
  "devDependencies": {
    "turbo": "^2"
  },
  "packageManager": "bun@1.2.4"
}
```

### turbo.json Task Graph

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

**`dependsOn: ["^build"]`** — Each task waits for all upstream packages' build to complete before starting.

---

## Consequences

### Positive
- **Shared schema everywhere:** Dashboard imports `@sessionforge/db`, types are **always in sync** with database
- **Fast cold installs:** Bun's parallel download resolves workspaces 3–4× faster than npm (~30s vs ~2 min on Vercel)
- **Task caching:** Turbo caches build outputs; `turbo dev` reuses `.next` and `dist/` from prior runs
- **Single lock file:** `bun.lock` (one version source of truth; no duplicate dependencies)
- **Future extensibility:** Adding a CLI package (`apps/cli/`) or another service is straightforward

### Negative
- **Bun-specific:** Requires Bun in CI/CD and development environments. npm/pnpm cannot install the lockfile
- **Turbo learning curve:** Task graph config is non-obvious (circular dependencies, caching behavior)
- **Workspace hoisting:** Shared `node_modules` in monorepo root; some tools struggle with symlinked dependencies

### Neutral
- **Schema split adds files:** Schema was split into `enums/types/tables/relations.ts` per Wave 4b (H3), adding 4 files instead of 1 monolith

---

## Alternatives Considered

1. **Single app + shared database via Docker**
   - Rationale: Database is a service, not a package
   - Trade-off: Requires local Postgres running; adds container coordination; schema versioning harder
   - Rejected: Monorepo approach is simpler for co-evolved schema + app

2. **npm workspaces + Turbo (no Bun)**
   - Rationale: npm is ubiquitous; fewer setup surprises
   - Trade-off: Slower cold installs; npm v10+ workspaces less mature than pnpm/Bun equivalents
   - Rejected: Bun's 3–4× speed advantage is material for Vercel builds

3. **Monorepo without task orchestration (flat structure)**
   - Rationale: Simpler mental model; all deps installed upfront
   - Trade-off: Build errors hard to debug; no incremental builds; redundant deps installed per app
   - Rejected: Turbo's task graph catches build-order mistakes early

---

## References

- `root package.json:4–5` — workspaces declaration
- `turbo.json:3–6` — task graph with `dependsOn`
- `packages/db/package.json` — `@sessionforge/db` exports schema
- `apps/dashboard/package.json:26` — imports `"@sessionforge/db": "workspace:*"`
- `ADR 004` — rationale for keeping 75 tables in a single schema file (deferred split)

---
