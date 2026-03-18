# SessionForge Unified Impact Diagrams Index

All diagrams follow Diagram Driven Development (DDD) methodology — connecting Front-Stage (user experience) to Back-Stage (implementation) with impact annotations.

**Last Updated:** 2026-03-18

## Architecture

- [System Overview](architecture/arch-system-overview.md) - Full stack: 12 AI agents, 5 publishing targets, scanning pipeline, analytics, writing coach
- [Session Scanning Pipeline](architecture/arch-session-scanning-pipeline.md) - Scanner → Parser → Normalizer → Indexer → Miner with fault tolerance

## User Journeys

- [Sessions to Content](journeys/sequence-session-to-content.md) - 3-click path: scan → analyze → generate blog post with streaming
- [Draft to Published Post](journeys/sequence-content-to-publish.md) - AI chat refinement → SEO → multi-platform publish

## Features

- [Content Editor](features/feature-content-editor.md) - 28 interactions: split view, 6 sidebar panels, 5 publish modals, keyboard shortcuts
- [Session Scanning](features/feature-session-scanning.md) - Local + SSH + upload, SSE progress, filters, multi-select batch extract
- [Insights & Corpus Analysis](features/feature-insights-analysis.md) - 4-agent pipeline, recommendations engine, batch content generation
- [Automation Triggers](features/feature-automation-triggers.md) - Scheduled/file-watch/manual triggers, QStash cron, batch generate
- [Writing Coach](features/feature-writing-coach.md) - Authenticity scoring, AI cliche detection, voice consistency, benchmarks
- [Social Analytics](features/feature-analytics-social.md) - Impressions/likes/shares/comments/clicks across Twitter + LinkedIn
- [Onboarding Wizard](features/feature-onboarding-wizard.md) - Guided setup, welcome banner, sidebar checklist

## Audit Results (2026-03-18)

Full functional audit: **149/149 interactions PASS (100%)** after fixing 4 issues: Writing Coach analyze button wired, onboarding link fixed, voice deviations derived, publish modals lazy-loaded. See `plans/reports/audit-260318-1739-full-functional-audit.md`.

## Recent Changes

- **2026-03-18:** Full DDD bootstrap — 11 diagrams across architecture, journeys, and features. Enhanced with findings from exhaustive 21-page functional audit (148 interactions).
