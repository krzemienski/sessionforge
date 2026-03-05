/**
 * SessionMiner — full-text search index over indexed Claude session messages.
 *
 * Builds a MiniSearch index from claudeSessions.rawMetadata.messages stored in
 * the database, caches it in-memory with a configurable TTL, and exposes a
 * fuzzy search API that returns ranked, excerpted results.
 */

import MiniSearch from "minisearch";
import { db } from "@/lib/db";
import { claudeSessions } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";

// ── Types ──────────────────────────────────────────────────────────────────

/** A single indexable unit: one message from one session. */
export interface MinerDocument {
  /** Composite ID: `${sessionId}:${messageIndex}` */
  id: string;
  /** DB row id of the parent claudeSessions row. */
  sessionRowId: string;
  /** Claude session UUID. */
  sessionId: string;
  /** Absolute path to the source JSONL file. */
  filePath: string;
  /** Zero-based index of this message within the session. */
  messageIndex: number;
  /** Text content of the message (may be truncated for large messages). */
  content: string;
  /** Human-readable project name. */
  projectName: string;
  /** "user" | "assistant" */
  role: string;
  /** ISO-8601 timestamp of the message (or session start if absent). */
  timestamp: string;
}

/** A single search hit including context excerpt and score. */
export interface SearchHit {
  document: MinerDocument;
  /** Relevance score from MiniSearch (higher = more relevant). */
  score: number;
  /** Short excerpt around matched content (≤400 chars). */
  contextExcerpt: string;
}

/** Summary of the current index state. */
export interface IndexStatus {
  totalSessions: number;
  totalDocuments: number;
  lastBuilt: string | null;
}

// ── Raw message shape stored in rawMetadata.messages ──────────────────────

interface RawMessage {
  role?: string;
  content?: string | Array<{ type: string; text?: string }>;
  timestamp?: string;
}

function extractText(content: RawMessage["content"]): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  return content
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text!)
    .join(" ");
}

// ── In-memory cache ────────────────────────────────────────────────────────

const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface IndexCache {
  index: MiniSearch<MinerDocument>;
  documents: Map<string, MinerDocument>;
  builtAt: Date;
  workspaceId: string;
}

const caches = new Map<string, IndexCache>();

// ── SessionMiner ──────────────────────────────────────────────────────────

export class SessionMiner {
  private readonly workspaceId: string;
  private readonly ttlMs: number;

  constructor(workspaceId: string, ttlMs = DEFAULT_TTL_MS) {
    this.workspaceId = workspaceId;
    this.ttlMs = ttlMs;
  }

  // ── Index management ──

  private isCacheValid(): boolean {
    const cache = caches.get(this.workspaceId);
    if (!cache) return false;
    return Date.now() - cache.builtAt.getTime() < this.ttlMs;
  }

  /**
   * Builds (or returns cached) MiniSearch index for the workspace.
   * Loads all sessions with rawMetadata from the DB and indexes every message.
   *
   * @param onProgress - optional callback called with (indexed, total) as sessions are processed
   */
  async buildIndex(
    onProgress?: (indexed: number, total: number) => void
  ): Promise<IndexCache> {
    if (this.isCacheValid()) {
      return caches.get(this.workspaceId)!;
    }

    const index = new MiniSearch<MinerDocument>({
      fields: ["content", "projectName"],
      storeFields: [
        "id",
        "sessionRowId",
        "sessionId",
        "filePath",
        "messageIndex",
        "content",
        "projectName",
        "role",
        "timestamp",
      ],
      searchOptions: {
        fuzzy: 0.2,
        prefix: true,
        boost: { content: 2, projectName: 1 },
      },
    });

    const documents = new Map<string, MinerDocument>();

    // Load all sessions for this workspace that have rawMetadata
    const rows = await db
      .select({
        id: claudeSessions.id,
        sessionId: claudeSessions.sessionId,
        filePath: claudeSessions.filePath,
        projectName: claudeSessions.projectName,
        startedAt: claudeSessions.startedAt,
        rawMetadata: claudeSessions.rawMetadata,
      })
      .from(claudeSessions)
      .where(eq(claudeSessions.workspaceId, this.workspaceId));

    const total = rows.length;
    let indexed = 0;

    for (const row of rows) {
      const raw = row.rawMetadata as { messages?: RawMessage[] } | null;
      const messages = raw?.messages ?? [];

      messages.forEach((msg, idx) => {
        const content = extractText(msg.content);
        if (!content.trim()) return;

        const doc: MinerDocument = {
          id: `${row.sessionId}:${idx}`,
          sessionRowId: row.id,
          sessionId: row.sessionId,
          filePath: row.filePath,
          messageIndex: idx,
          content: content.slice(0, 10_000), // cap to avoid huge documents
          projectName: row.projectName,
          role: msg.role ?? "unknown",
          timestamp: msg.timestamp ?? row.startedAt.toISOString(),
        };

        index.add(doc);
        documents.set(doc.id, doc);
      });

      indexed++;
      if (onProgress && indexed % 50 === 0) {
        onProgress(indexed, total);
      }
    }

    if (onProgress) onProgress(indexed, total);

    const cache: IndexCache = {
      index,
      documents,
      builtAt: new Date(),
      workspaceId: this.workspaceId,
    };

    caches.set(this.workspaceId, cache);
    return cache;
  }

  /** Invalidate the cached index for this workspace. */
  invalidate(): void {
    caches.delete(this.workspaceId);
  }

  // ── Search ────────────────────────────────────────────────────────────────

  /**
   * Fuzzy-search the session index for `topic`.
   * Returns up to `limit` ranked hits with context excerpts.
   */
  async search(topic: string, limit = 20): Promise<SearchHit[]> {
    const cache = await this.buildIndex();
    const results = cache.index.search(topic).slice(0, limit);

    return results.map((result) => {
      const doc = cache.documents.get(result.id)!;
      return {
        document: doc,
        score: result.score,
        contextExcerpt: extractExcerpt(doc.content, topic),
      };
    });
  }

  // ── Status ────────────────────────────────────────────────────────────────

  /** Returns index metadata without triggering a rebuild. */
  async getIndexStatus(): Promise<IndexStatus> {
    const cache = caches.get(this.workspaceId);

    if (!cache || !this.isCacheValid()) {
      // Count sessions in DB without loading rawMetadata
      const rows = await db
        .select({ id: claudeSessions.id })
        .from(claudeSessions)
        .where(eq(claudeSessions.workspaceId, this.workspaceId));

      return {
        totalSessions: rows.length,
        totalDocuments: 0,
        lastBuilt: null,
      };
    }

    return {
      totalSessions: new Set(
        [...cache.documents.values()].map((d) => d.sessionId)
      ).size,
      totalDocuments: cache.documents.size,
      lastBuilt: cache.builtAt.toISOString(),
    };
  }
}

// ── Excerpt helper ────────────────────────────────────────────────────────

/**
 * Extracts a short excerpt from `text` around the first occurrence of any
 * word from `query`. Falls back to the first 400 chars.
 */
function extractExcerpt(text: string, query: string, windowSize = 200): string {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const lower = text.toLowerCase();

  let bestPos = -1;
  for (const word of words) {
    const pos = lower.indexOf(word);
    if (pos !== -1 && (bestPos === -1 || pos < bestPos)) {
      bestPos = pos;
    }
  }

  if (bestPos === -1) {
    return text.slice(0, 400).trim();
  }

  const start = Math.max(0, bestPos - windowSize / 2);
  const end = Math.min(text.length, bestPos + windowSize / 2);
  let excerpt = text.slice(start, end).trim();

  if (start > 0) excerpt = "…" + excerpt;
  if (end < text.length) excerpt = excerpt + "…";

  return excerpt;
}
