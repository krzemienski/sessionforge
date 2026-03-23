---
phase: 02
slug: docker-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Shell commands + docker compose (no unit test framework) |
| **Config file** | docker-compose.yml |
| **Quick run command** | `docker compose ps --format json` |
| **Full suite command** | `docker compose down -v && docker compose up -d --build && sleep 30 && docker compose ps` |
| **Estimated runtime** | ~60 seconds (build + startup + healthcheck) |

---

## Sampling Rate

- **After every task commit:** Run `bun run build` (catches TS errors from Dockerfile/entrypoint changes)
- **After every plan wave:** Run `docker compose up -d --build && docker compose ps`
- **Before `/gsd:verify-work`:** Full suite must show all containers healthy
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | DOCK-06 | build | `docker build -t sessionforge:test .` | ✅ Dockerfile | ⬜ pending |
| 02-01-02 | 01 | 1 | DOCK-02 | script | `test -f packages/db/src/migrate.ts` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | DOCK-05 | build | `docker build -t sessionforge:test .` | ✅ Dockerfile | ⬜ pending |
| 02-02-01 | 02 | 2 | DOCK-01 | compose | `docker compose up -d --build && docker compose ps` | ✅ docker-compose.yml | ⬜ pending |
| 02-02-02 | 02 | 2 | DOCK-04 | health | `docker compose ps --format json \| grep healthy` | ✅ docker-compose.yml | ⬜ pending |
| 02-03-01 | 03 | 3 | DOCK-07 | grep | `grep DATABASE_URL .env.example` | ✅ .env.example | ⬜ pending |
| 02-03-02 | 03 | 3 | DOCK-03 | curl | `curl -s http://localhost:3000/api/healthcheck` | ✅ route.ts | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/db/src/migrate.ts` — migration runner script (does not exist yet)
- [ ] `docker-entrypoint.sh` — entrypoint script for migration + app start

*Existing infrastructure covers remaining requirements (Dockerfile, compose files, healthcheck routes).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| App accessible at localhost:3000 | DOCK-01, DOCK-03 | Requires browser or curl from host | `curl http://localhost:3000` after compose up |
| Schema auto-migrated | DOCK-02 | Requires checking DB state | `docker compose exec postgres psql -U sessionforge -c '\dt'` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
