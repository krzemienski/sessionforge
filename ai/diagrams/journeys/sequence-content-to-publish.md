# From Draft to Published Post

**Type:** Sequence Diagram
**Last Updated:** 2026-03-18
**Related Files:**
- `apps/dashboard/src/app/(dashboard)/[workspace]/content/[postId]/page.tsx`
- `apps/dashboard/src/lib/ai/agents/editor-chat.ts`
- `apps/dashboard/src/lib/seo/scoring.ts`
- `apps/dashboard/src/lib/publishing/hashnode.ts`

## Purpose

Shows the editing and publishing journey — AI-assisted refinement, SEO optimization, and multi-platform publishing.

## Diagram

```mermaid
sequenceDiagram
    actor Dev as Developer
    participant Editor as Content Editor
    participant Chat as AI Chat Panel
    participant SEO as SEO Analyzer
    participant Rev as Revision System
    participant Pub as Publishing Service
    participant Platforms as 5 Platforms

    Dev->>Editor: Opens draft (split view) ⚡
    Dev->>Chat: "Make intro more engaging"
    Chat->>Chat: edit_markdown tool 🛡️
    Chat-->>Editor: Non-destructive edit applied
    Rev->>Rev: Auto-save every 2min 💾

    Dev->>SEO: Clicks SEO tab
    SEO-->>Dev: Score + checklist + recommendations 📊
    Dev->>SEO: Generate Meta
    SEO-->>Editor: AI-generated title, description, OG tags 🎯

    Dev->>Editor: Clicks Publish
    Editor->>Pub: Publish to selected platform 🛡️
    Pub->>Platforms: Cross-post with canonical URL

    alt Success
        Platforms-->>Dev: Published! View link → ✅
    else Failure
        Platforms-->>Dev: Error + retry option 🔄
    end

    Dev->>Editor: Repurpose → Twitter thread, LinkedIn post 🎯
```

## Key Insights

- **Non-Destructive AI Edits**: `edit_markdown` creates minor revisions — every change tracked and reversible
- **2-Minute Auto-Save**: Maximum data loss boundary
- **5 Publish Targets**: Hashnode, WordPress, Dev.to, Ghost, Medium — all with canonical URLs
- **Repurposing**: One blog post transforms into Twitter threads, LinkedIn posts, newsletters, changelogs

## Change History

- **2026-03-18:** Initial creation
