# Session Scanning & Discovery

**Type:** Feature Diagram
**Last Updated:** 2026-03-18
**Related Files:**
- `apps/dashboard/src/app/(dashboard)/[workspace]/sessions/page.tsx`
- `apps/dashboard/src/lib/sessions/scanner.ts`
- `apps/dashboard/src/lib/sessions/ssh-scanner.ts`
- `apps/dashboard/src/lib/sessions/parser.ts`
- `apps/dashboard/src/lib/sessions/normalizer.ts`
- `apps/dashboard/src/lib/sessions/indexer.ts`
- `apps/dashboard/src/lib/sessions/miner.ts`

## Purpose

Discovers and indexes Claude Code sessions from local machines, remote servers, or manual uploads — transforming raw JSONL logs into searchable knowledge.

## Diagram

```mermaid
graph TD
    subgraph "Front-Stage (User Experience)"
        User[Developer on Sessions Page] --> ScanBtn[Scan Now ⚡ Incremental SSE]
        User --> RescanBtn[Full Rescan 🔄 Re-index everything]
        User --> UploadBtn[Upload JSONL ✅ Drag & drop]
        User --> SearchBar[Search ⚡ Fuzzy full-text]
        User --> Filters[Filters Panel 📊 Date/project/messages/summary]
        User --> SelectAll[Multi-Select + Batch Extract Insights 🎯]

        ScanBtn --> ProgressBar[Live Progress Bar ⏱️ SSE with cancel]
        ProgressBar --> SessionList[Sessions List ✅]
        SearchBar --> SearchResults[Ranked Results ⚡ With excerpts]
    end

    subgraph "Back-Stage (Implementation)"
        ScanBtn --> LocalScan[Local Scanner 🎯]
        ScanBtn --> SSHScan[SSH Scanner 🎯]
        UploadBtn --> UploadProc[Upload Processor ✅]
        LocalScan --> Parser[JSONL Parser → Normalizer → Classifier 📊]
        SSHScan --> Parser
        UploadProc --> Parser
        Parser --> Indexer[Indexer 💾 Upsert by UUID]
        Indexer --> DB[(PostgreSQL 💾)]
        DB --> MiniSearch[MiniSearch ⚡ 10-min TTL cache]
    end

    MiniSearch --> SearchResults
    SSHScan -->|Timeout| Skip[Skip Source 🔄]
    Parser -->|Error| SkipFile[Skip File 🔄]
```

## Key Insights

- **14 Interactions**: Scan (incremental + full), upload, search, filters (5 types), multi-select, batch extract, pagination, flow banner, empty states
- **Shift+Click Range Selection**: Power user feature for selecting contiguous session ranges
- **Streaming Scan Progress**: SSE shows file-by-file progress with AI analysis phase indication
- **Smart Empty States**: First visit shows "Welcome! Let's get started"; subsequent shows "No sessions found"

## Change History

- **2026-03-18:** Initial creation — enhanced with full audit interaction count
