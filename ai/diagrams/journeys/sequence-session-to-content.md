# From Sessions to Published Content

**Type:** Sequence Diagram
**Last Updated:** 2026-03-18
**Related Files:**
- `apps/dashboard/src/lib/sessions/scanner.ts`
- `apps/dashboard/src/lib/ai/agents/insight-extractor.ts`
- `apps/dashboard/src/lib/ai/agents/blog-writer.ts`
- `apps/dashboard/src/app/api/content/mine-sessions/route.ts`

## Purpose

Traces the core value proposition: from scanning coding sessions to having a publishable blog post in 3 clicks.

## Diagram

```mermaid
sequenceDiagram
    actor Dev as Developer
    participant Dash as Dashboard
    participant Scan as Session Scanner
    participant DB as PostgreSQL
    participant Insight as Insight Extractor
    participant Blog as Blog Writer
    participant Editor as Content Editor

    Dev->>Dash: Opens Sessions page
    Dev->>Dash: Clicks 'Scan Now'
    Dash->>Scan: POST /api/v1/sessions/scan

    loop SSE Progress
        Scan-->>Dash: Progress (found N files)
    end

    Scan->>DB: Upsert parsed sessions 💾
    Scan-->>Dash: Scan complete ✅
    Dash-->>Dev: N sessions discovered

    Dev->>Dash: Opens Insights → Start Analysis
    Dash->>Insight: POST /api/insights/analyze (SSE)
    Insight->>DB: Read sessions, detect patterns 📊
    Insight->>DB: Store insights
    Insight-->>Dash: Analysis complete
    Dash-->>Dev: Patterns & topics discovered ✅

    Dev->>Dash: Selects insight → Write Post
    Dash->>Blog: POST /api/agents/blog
    Note over Blog: Applies style profile 🎯

    loop Streaming Content
        Blog-->>Dash: Markdown chunks ⚡
    end

    Blog->>DB: Save draft 💾
    Dash->>Editor: Open in editor
    Editor-->>Dev: Ready to refine ✅

    alt Generation Fails
        Blog-->>Dash: Error 🔄
        Dash-->>Dev: Retry option
    end
```

## Key Insights

- **3-Click Path**: Scan → Analyze → Write Post
- **Style Matching**: Blog writer applies learned style profile
- **Live Streaming**: Content generation streams via SSE in real-time
- **Evidence-Based**: Posts include citations back to session moments

## Change History

- **2026-03-18:** Initial creation
