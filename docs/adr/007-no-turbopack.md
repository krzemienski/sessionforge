# ADR 007: No Turbopack in Next.js Dev (Use Default next dev)

**Date:** 2026-04-18
**Status:** Accepted
**Deciders:** Nick (Engineering Lead)

---

## Context

Next.js 15 introduced Turbopack as an optional faster bundler for local development. Turbopack promises sub-second hot reloads on large component trees. However, SessionForge uses Drizzle ORM with Drizzle relations, and **Turbopack has a known bug** that breaks relation resolution in bun monorepos.

Early testing (2026-04) revealed:

- `next dev --turbopack` in the monorepo context causes Drizzle relations to resolve to `undefined`
- Workaround: Use the default Webpack-based bundler (`next dev` without flag)
- Bug affects: `drizzle-orm/relations` re-exports and workspace symlinks

---

## Decision

**Run Next.js dev server with `next dev` (default Webpack bundler), not `next dev --turbopack`.**

### Configuration

**File:** `apps/dashboard/package.json`

```json
{
  "scripts": {
    "dev": "next dev"
  }
}
```

**NOT:**
```json
{
  "scripts": {
    "dev": "next dev --turbopack"
  }
}
```

---

## Impact

- **Dev server startup:** ~2–3 seconds (vs ~1 second with Turbopack)
- **Hot reload latency:** ~500–800ms (vs ~300ms with Turbopack)
- **Drizzle relations:** Always resolve correctly
- **Build process:** Unaffected (`next build` uses Webpack; Turbopack is dev-only)

---

## Consequences

### Positive
- **No broken relations:** Drizzle ORM works reliably in development
- **Monorepo compatibility:** Webpack-based bundler handles bun workspace symlinks correctly
- **Dev experience:** Slightly slower hot reload is acceptable for a content-generation app (human-paced, not latency-sensitive)

### Negative
- **Development speed trade-off:** ~500ms slower hot reload than Turbopack would provide
- **Dependency on legacy bundler:** Webpack is mature but not actively innovated; Turbopack is the future
- **Not future-proof:** When Turbopack matures, this decision must be revisited

### Neutral
- **Production builds unaffected:** `next build` uses Webpack regardless; production performance is unchanged

---

## Workarounds Considered

1. **Pin Turbopack version and wait for fix**
   - Rationale: Turbopack is actively maintained; bug may be fixed in next release
   - Trade-off: Uncertainty; bug fix timeline unknown; dev experience broken in the meantime
   - Rejected: Too risky for active development

2. **Use `next dev` with experimental Turbopack improvements**
   - Rationale: Next.js team may patch the issue in canary builds
   - Trade-off: Canary builds are unstable; not recommended for production apps
   - Rejected: Stability over speed

3. **Refactor Drizzle relations to avoid the bug**
   - Rationale: If the bug is specific to relation re-exports, inline relation definitions
   - Trade-off: Breaks the DRY pattern; duplicates relation definitions across files
   - Rejected: The bug is in Turbopack's resolution logic, not in our code

---

## Timeline & Escalation

- **2026-04:** Turbopack relation bug identified; `next dev` used as workaround
- **2026-Q3+:** Monitor Turbopack releases for relation bug fix
- **Trigger for revisit:** Turbopack >v0.3 or Next.js >15.2 with confirmed relation fix

---

## References

- `apps/dashboard/package.json:11` — `"dev": "next dev"` (no --turbopack flag)
- `~/.claude/rules/project.md` — "Dev Server Management" section
- Turbopack issue tracker: https://github.com/vercel/turbo/issues (search: "drizzle relations")

---
