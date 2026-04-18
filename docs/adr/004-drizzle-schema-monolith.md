# ADR 004: Drizzle Schema Monolith (75 Tables in One File)

**Date:** 2026-04-18
**Status:** Accepted
**Deciders:** Nick (Engineering Lead)

---

## Context

SessionForge's domain is rich: sessions, posts, insights, automation, analytics, integrations, etc. Early design kept all table definitions (`pgTable()` calls) in a single `schema.ts` file for simplicity.

By 2026-04-17, this has grown to **75 tables** and **~1,875 lines** in `packages/db/src/schema/tables.ts`. The file handles:

- User management (`users`, `workspaces`)
- Session data (`claude_sessions`, `insights`, `post_evidence`)
- Content (`posts`, `post_revisions`, `post_media`, `series`, `collections`)
- Integrations (`integration_accounts`, `integration_credentials`)
- Automation (`content_triggers`, `automation_pipeline_runs`)
- Analytics (`social_analytics_snapshots`)
- Stripe idempotency (`stripe_webhook_events`)

---

## Decision

**Keep all 75 tables in one `packages/db/src/schema/tables.ts` file. Defer further splitting until Wave 4b completion.**

### Rationale

1. **Single source of truth:** All tables visible in one context tree (LSP, grep, search)
2. **Relation clarity:** Foreign keys reference tables in the same file; easy to validate referential integrity
3. **Type coherence:** All table types exported from one barrel (`schema.ts`); no import path surprises
4. **No import cycles:** Splitting by domain would create bidirectional imports (e.g., posts → series, series → posts)

### Current Structure

```
packages/db/src/schema/
├── tables.ts           # 75 pgTable definitions (1,875 lines)
├── enums.ts            # Enums used by tables
├── types.ts            # TypeScript-only interfaces
├── relations.ts        # Drizzle relations
└── schema.ts           # Barrel: export * from ./tables, ./enums, ./relations
```

---

## Consequences

### Positive
- **Low cognitive friction:** Single file to grep, read, understand schema design
- **No refactoring debt:** No premature splitting; change happens when pain is real
- **Type stability:** Table types exported from one location; zero transitive import issues

### Negative
- **File size:** 1,875 lines approaches LSP and editor performance limits on lower-spec machines
- **Cognitive load:** Developers new to the project must read 1,875 lines to understand the schema
- **Merge conflicts:** High-volume schema changes land in a single file; many concurrent feature branches = conflict overhead

### Neutral
- **No IDE warnings:** Modern IDEs handle 1,875-line files without issue
- **Git diff noise:** Schema changes produce long diffs; review burden is high but not insurmountable

---

## Splitting Strategy (Wave 4b Deferred)

Once the domain stabilizes (Wave 4b completion, expected ~2026-05-15), split into domain files:

```
packages/db/src/schema/
├── tables/
│   ├── users.ts           # users, workspaces
│   ├── sessions.ts        # claude_sessions, insights, post_evidence
│   ├── content.ts         # posts, post_revisions, series, collections
│   ├── integrations.ts    # integration_accounts, integration_credentials
│   ├── automation.ts      # content_triggers, automation_pipeline_runs
│   ├── analytics.ts       # social_analytics_snapshots
│   └── billing.ts         # stripe_webhook_events, stripe_customers
├── enums.ts               # Unified enum file
├── types.ts               # Unified type file
├── relations.ts           # Unified relations
└── schema.ts              # Barrel: import * from ./tables/*, ./enums, ./relations
```

**Constraint:** No cross-domain imports. Relations between domains defined in a separate `relations.ts` to avoid cycles.

---

## Alternatives Considered

1. **Split now into domain files**
   - Rationale: Better code organization; easier to find a table
   - Trade-off: Requires refactoring all imports; 75 table definitions split across 7 files; relation definitions fragmented
   - Rejected: Schema is still evolving; splitting adds overhead for uncertain benefit

2. **Generate schema from database introspection**
   - Rationale: Single source of truth in database; schema.ts is always in sync
   - Trade-off: Tightly couples schema tooling to Drizzle Kit; harder to version schema changes in Git
   - Rejected: Drizzle's code-first approach is aligned with the monorepo philosophy

3. **Use a schema builder library (e.g., JSON Schema + code generation)**
   - Rationale: Higher-level abstraction; generate tables, types, validation from single YAML
   - Trade-off: Adds build-time complexity; loses Drizzle's type inference
   - Rejected: Drizzle's TypeScript-first approach is already excellent

---

## Metrics

- **Current size:** 75 tables, 1,875 lines, ~3,032 bytes
- **Table growth rate:** ~5 tables per 2-month phase
- **Projected size at Wave 4b:** ~85 tables, ~2,200 lines (within acceptable range)
- **Split trigger:** Exceeds 2,500 lines OR >100 tables

---

## References

- `packages/db/src/schema/tables.ts` — primary table definitions file
- `packages/db/src/schema.ts` — barrel (re-exports all)
- `~/.claude/rules/documentation-management.md` → Roadmap (Wave 4b split scheduled for ~2026-05-15)

---
