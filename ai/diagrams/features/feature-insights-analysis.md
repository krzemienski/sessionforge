# Insights & Corpus Analysis

**Type:** Feature Diagram
**Last Updated:** 2026-03-18
**Related Files:**
- `apps/dashboard/src/app/(dashboard)/[workspace]/insights/page.tsx`
- `apps/dashboard/src/lib/ai/agents/insight-extractor.ts`
- `apps/dashboard/src/lib/ai/agents/corpus-analyzer.ts`
- `apps/dashboard/src/lib/ai/agents/content-strategist.ts`
- `apps/dashboard/src/lib/ai/agents/recommendations-analyzer.ts`

## Purpose

The intelligence layer between sessions and content — detects patterns, extracts themes, recommends topics, and plans content series from related insights.

## Diagram

```mermaid
graph TD
    subgraph "Front-Stage (User Experience)"
        User[Developer Opens Insights] --> AnalyzeBtn[Start Analysis 📊 With lookback selector]
        AnalyzeBtn --> PipelineTrace[Pipeline Progress ⏱️ SSE stage trace]
        PipelineTrace --> InsightCards[Insight Cards ✅ Category + score + evidence]
        InsightCards --> WriteBtn[Write Post 🎯 Pre-populated context]
        User --> Recommendations[Suggested Topics 📊 Accept or dismiss]
        Recommendations --> AcceptBtn[Accept → content/new with topic 🎯]
        User --> MultiSelect[Multi-Select → Batch Generate Content 🎯]
    end

    subgraph "Back-Stage (4-Agent Pipeline)"
        AnalyzeBtn --> PatternDetector[Pattern Detector 📊 Recurring themes]
        PatternDetector --> Extractor[Insight Extractor 🎯 Specific insights]
        Extractor --> Recommender[Recommendations Analyzer 📊 Scored topics]
        Recommender --> Strategist[Content Strategist 🎯 Multi-post series]
    end

    Extractor --> DB[(PostgreSQL 💾)]
    DB --> InsightCards

    User --> EmptyState{Sessions exist?}
    EmptyState -->|No| ScanCTA[Scan Sessions ✅ Guides to sessions page]
    EmptyState -->|Yes, no results| WidenCTA[Try Wider Date Range 🔄]
```

## Key Insights

- **6-Dimension Scoring**: Novelty (3x), tool patterns (3x), transformation (2x), failure recovery (3x), reproducibility (1x), scale (1x) — composite out of 65
- **Recommendation Engine**: Topics ranked by priority, each with Accept (→ content/new) and Dismiss actions
- **Smart Empty States**: "No sessions" → scan CTA; "sessions but no insights" → start analysis CTA
- **Batch Content Generation**: Select multiple insights → generate content for all in one batch job

## Change History

- **2026-03-18:** Initial creation
