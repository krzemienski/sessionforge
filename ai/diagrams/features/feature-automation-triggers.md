# Automation Triggers & Scheduled Content Generation

**Type:** Feature Diagram
**Last Updated:** 2026-03-18
**Related Files:**
- `apps/dashboard/src/app/(dashboard)/[workspace]/automation/page.tsx`
- `apps/dashboard/src/app/api/automation/execute/route.ts`
- `apps/dashboard/src/lib/automation/pipeline.ts`
- `apps/dashboard/src/lib/automation/cron-utils.ts`

## Purpose

Lets developers set up content generation on autopilot — configure a trigger once, and SessionForge generates posts on schedule without manual intervention.

## Diagram

```mermaid
graph TD
    subgraph "Front-Stage (User Experience)"
        User[Developer Opens Automation] --> TriggerList[Trigger List ⚡]
        TriggerList --> CreateTrigger[New Trigger Dialog ✅ name/type/content/cron/lookback]
        TriggerList --> Toggle[Toggle Enable/Disable ⚡]
        TriggerList --> RunNow[Run Now Button ⚡]
        TriggerList --> ViewRuns[Recent Runs 📊 Per-trigger history]
        User --> BatchGen[Batch Generate Section 🎯 Type + count → generate]
    end

    subgraph "Back-Stage (Implementation)"
        CreateTrigger --> QStash[QStash Cron ⏱️ Fires regardless of browser]
        RunNow --> DirectExec[Direct Execution 🛡️ Session auth]
        QStash --> AuthCheck{Signature Valid?}
        DirectExec --> AuthCheck
        AuthCheck -->|Yes| Pipeline[Pipeline: scan → extract → generate 🎯]
        AuthCheck -->|No| Reject[401 🛡️]

        Pipeline --> SSE[SSE Progress ⏱️ Real-time stages]
        Pipeline --> Metrics[Run Metrics 💾 Duration, tokens, errors]
    end

    Pipeline --> ViewRuns
    Pipeline -->|SSH Timeout| SkipSource[Skip Source 🔄]
    Pipeline -->|Agent Error| PartialFail[Partial Failure 🔄 Mark as partial]
    AuthCheck -->|No QStash| ManualOnly[Manual-Only Mode 🔄]
```

## Key Insights

- **3 Trigger Types**: Scheduled (cron), File Watch (debounced), Manual
- **7 Content Types**: Blog post, Twitter thread, LinkedIn post, Dev.to article, changelog, newsletter, custom
- **Dual Auth**: QStash signature for scheduled; session auth for manual — same pipeline
- **Batch Generate**: Generate multiple posts from top insights in one click
- **Auto-Refresh**: Run list polls every 3s when active runs exist

## Change History

- **2026-03-18:** Initial creation
