# Content Editor — Full Feature Map

**Type:** Feature Diagram
**Last Updated:** 2026-03-18
**Related Files:**
- `apps/dashboard/src/app/(dashboard)/[workspace]/content/[postId]/page.tsx`
- `apps/dashboard/src/components/editor/markdown-editor.tsx`
- `apps/dashboard/src/components/editor/ai-chat-sidebar.tsx`
- `apps/dashboard/src/components/editor/seo-panel.tsx`
- `apps/dashboard/src/components/editor/evidence-explorer.tsx`
- `apps/dashboard/src/components/editor/supplementary-panel.tsx`
- `apps/dashboard/src/components/editor/media-panel.tsx`
- `apps/dashboard/src/components/editor/repository-panel.tsx`
- `apps/dashboard/src/components/editor/revision-history-panel.tsx`
- `apps/dashboard/src/components/publish/hashnode-publish-modal.tsx`
- `apps/dashboard/src/components/publishing/devto-publish-modal.tsx`
- `apps/dashboard/src/components/publishing/ghost-publish-modal.tsx`
- `apps/dashboard/src/components/publishing/medium-publish-modal.tsx`

## Purpose

The most feature-rich page in SessionForge (28 interactions). Developers refine AI-generated drafts with live AI chat, optimize SEO, and publish to 5 platforms — all without leaving one screen.

## Diagram

```mermaid
graph TD
    subgraph "Front-Stage (User Experience)"
        User[Developer Opens Post] --> ViewModes{View Mode}
        ViewModes -->|Edit| EditMode[Markdown Editor ⚡]
        ViewModes -->|Split| SplitMode[Side-by-Side ⚡ Default]
        ViewModes -->|Preview| PreviewMode[Rendered Preview ✅]

        User --> Actions[Action Bar]
        Actions --> SaveBtn[Save Cmd+S 💾 Major revision + SEO re-analyze]
        Actions --> PublishBtn[Publish Cmd+Shift+P ✅]
        Actions --> ExportDrop[Export Dropdown 📊 Multiple formats]
        Actions --> SocialCopy[Social Copy Button ⚡]
        Actions --> Repurpose[Repurpose Button 🎯 → Twitter, LinkedIn, etc]
        Actions --> TemplateSave[Create Template from Post 💾]
    end

    subgraph "6 Sidebar Panels (Front-Stage)"
        User --> ChatTab[AI Chat 🎯 Natural language edits]
        User --> SEOTab[SEO Panel 📊 Score + checklist + meta gen]
        User --> EvidenceTab[Evidence Explorer 🎯 Session citations]
        User --> SupplementaryTab[Supplementary 🎯 TL;DR, takeaways]
        User --> MediaTab[Media 🎯 Diagram generation]
        User --> RepoTab[Repository 💾 Assets + revision history]
    end

    subgraph "5 Publish Modals (Front-Stage)"
        PublishBtn --> HashnodeModal[Hashnode 🎯]
        PublishBtn --> DevtoModal[Dev.to 🎯 If connected]
        PublishBtn --> GhostModal[Ghost 🎯 If connected]
        PublishBtn --> MediumModal[Medium 🎯 If connected]
        PublishBtn --> WPPublish[WordPress 🎯 If connected]
    end

    subgraph "Back-Stage (Implementation)"
        ChatTab --> EditorAgent[Editor Chat Agent ⏱️ Streaming tool-use]
        EditorAgent --> EditTool[edit_markdown 🛡️ Non-destructive]
        EditTool --> RevisionSys[Revision System 💾 Every edit tracked]

        SEOTab --> SEOScorer[SEO Scorer 📊 Readability + keywords]
        SEOTab --> MetaGen[Meta Generator 🎯 AI-powered]

        RevisionSys --> AutoSave[Auto-Save ⏱️ 2-min interval]
        AutoSave --> DB[(PostgreSQL 💾)]
    end

    EvidenceTab --> CitationClick[Citation Click → Evidence Panel 🎯]
    RepoTab --> RevHistory[Revision History: diff + restore 💾]
    Repurpose --> RepurposeTracker[Repurpose Tracker 📊 Generated variants]

    EditorAgent -->|Error| ChatError[Error in Chat 🔄 User can rephrase]
```

## Key Insights

- **28 Unique Interactions**: Most feature-dense page — edit modes, 6 sidebar panels, 5 publish modals, keyboard shortcuts, auto-save, repurpose
- **Non-Destructive AI Edits**: Every AI edit creates a minor revision in the history — fully reversible
- **Keyboard Shortcuts**: Cmd+S saves (major revision + triggers SEO re-analyze), Cmd+Shift+P publishes
- **Resizable Panels**: Layout saved to localStorage — persists across sessions
- **5 Publishing Integrations**: Hashnode always available; Dev.to, Ghost, Medium, WordPress shown conditionally when connected
- **Citation Interactivity**: Clicking a citation in the preview scrolls the evidence panel to the matching session moment
- **Authenticity Badge**: Shows AI slop score directly on the editor page
- **Series Navigation**: If post belongs to a series, shows prev/next links

## Change History

- **2026-03-18:** Initial creation — comprehensive from audit (28 interactions mapped)
