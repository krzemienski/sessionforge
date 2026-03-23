# Phase 2: Docker Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-23
**Phase:** 02-docker-hardening
**Areas discussed:** Migration strategy, Runner image, Sharp installation, CLAUDECODE env, Compose strategy, Redis in dev
**Mode:** --auto --analyze (all decisions auto-selected with trade-off analysis)

---

## Migration Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Entrypoint script (drizzle-kit push) | Run push before app starts | |
| Migration files (bun run src/migrate.ts) | Non-interactive, deterministic SQL | ✓ |
| Init container | Separate container for migration | |

**User's choice:** [auto] Migration files via entrypoint script (recommended — non-interactive, migrations already generated)
**Notes:** drizzle-kit push is known to hang on interactive prompts for new enums/columns. Phase 1 generated fresh migration files.

---

## Runner Image

| Option | Description | Selected |
|--------|-------------|----------|
| node:20-slim | Current image | |
| node:22-slim | LTS, per DOCK-06 requirement | ✓ |

**User's choice:** [auto] node:22-slim (non-negotiable requirement)
**Notes:** Straightforward base image swap.

---

## Sharp Installation

| Option | Description | Selected |
|--------|-------------|----------|
| Install in runner stage | Add libvips deps to node:22-slim | ✓ |
| Skip sharp | Remove next/image optimization | |

**User's choice:** [auto] Install in runner stage (required for next/image)
**Notes:** Sharp is already in dashboard deps. Node-slim needs native libraries.

---

## CLAUDECODE Environment

| Option | Description | Selected |
|--------|-------------|----------|
| Clear in Dockerfile | ENV CLAUDECODE= in runner stage | ✓ |
| Clear in entrypoint | unset in shell script | |

**User's choice:** [auto] Clear in Dockerfile (defensive, cheap insurance)
**Notes:** Prevents nested-session rejection when AI agents enabled in containers.

---

## Compose File Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Keep 3 separate files | Current state, clear separation | |
| Consolidate to 1 + override | Single entry, DRY | |
| docker-compose.yml as primary | Matches DOCK-01, self-hosted for prod | ✓ |

**User's choice:** [auto] docker-compose.yml as primary (recommended — satisfies DOCK-01)
**Notes:** Self-hosted compose kept for production use. Prod compose reviewed for redundancy.

---

## Redis in Dev

| Option | Description | Selected |
|--------|-------------|----------|
| Add to docker-compose.yml | Full parity with self-hosted | |
| Keep optional with fallback | Lighter dev, app handles missing Redis | ✓ |

**User's choice:** [auto] Keep optional (recommended — graceful fallback exists)
**Notes:** Queue/cache features disabled in dev without Redis. Acceptable for alpha.

---

## Claude's Discretion

Entrypoint script structure, build cache optimization, .dockerignore, healthcheck timing parameters.

## Deferred Ideas

None — discussion stayed within phase scope.
