# Session Scanning Pipeline Architecture

**Type:** Architecture Diagram
**Last Updated:** 2026-03-18
**Related Files:**
- `apps/dashboard/src/lib/sessions/scanner.ts`
- `apps/dashboard/src/lib/sessions/ssh-scanner.ts`
- `apps/dashboard/src/lib/sessions/parser.ts`
- `apps/dashboard/src/lib/sessions/normalizer.ts`
- `apps/dashboard/src/lib/sessions/indexer.ts`
- `apps/dashboard/src/lib/sessions/miner.ts`
- `apps/dashboard/src/lib/sessions/evidence-classifier.ts`
- `apps/dashboard/src/lib/sessions/upload-processor.ts`

## Purpose

Shows how raw Claude Code session files become searchable, indexed knowledge — the foundation of everything SessionForge does.

## Diagram

```mermaid
graph TD
    subgraph "Front-Stage (User Experience)"
        User[Developer Clicks 'Scan'] --> Progress[SSE Progress Stream ⚡ Real-time status]
        Progress --> Results[Sessions List ✅ Browse discovered sessions]
        Results --> Search[Full-Text Search ⚡ Sub-50ms fuzzy matching]
    end

    subgraph "Back-Stage (Implementation)"
        subgraph "Discovery"
            Progress --> LocalScan[Local Scanner 🎯 ~/.claude/sessions/]
            Progress --> SSHScan[SSH Scanner 🎯 Remote dev machines]
            Progress --> Upload[Upload Processor 🎯 Manual JSONL uploads]
        end

        subgraph "Processing"
            LocalScan --> Parser[Parser 📊 Extracts messages from JSONL]
            SSHScan --> Parser
            Upload --> Parser
            Parser --> Normalizer[Normalizer ✅ Consistent schema]
            Normalizer --> Classifier[Evidence Classifier 🎯 AI tags: tools, errors, decisions]
        end

        subgraph "Storage & Search"
            Classifier --> Indexer[Indexer 💾 Upserts to PostgreSQL]
            Indexer --> DB[(PostgreSQL 💾 claudeSessions table)]
            DB --> MiniSearch[MiniSearch Index ⚡ In-memory, 10-min TTL cache]
        end
    end

    MiniSearch --> Search
    Indexer --> Results

    SSHScan -->|Timeout| SkipSource[Skip Source 🔄 Continue remaining]
    Parser -->|Parse Error| SkipFile[Skip File 🔄 Log, continue next]
```

## Key Insights

- **Three Input Sources**: Local filesystem, SSH remote, manual JSONL upload
- **Incremental Scanning**: `sinceTimestamp` avoids re-scanning; 30-day default lookback
- **Evidence Classification**: AI tags sessions with tools used, errors, decisions — powering smart content suggestions
- **Deduplication**: Upsert by session UUID — rescanning never creates duplicates
- **Sub-50ms Search**: MiniSearch in-memory index with fuzzy matching and context excerpts

## Change History

- **2026-03-18:** Initial creation
