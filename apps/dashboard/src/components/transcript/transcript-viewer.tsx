"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSessionMessages } from "@/hooks/use-sessions";
import {
  useSessionBookmarks,
  useCreateBookmark,
  useDeleteBookmark,
} from "@/hooks/use-bookmarks";
import { useExtractInsights } from "@/hooks/use-insights";
import { TranscriptMessage, RawSessionEntry } from "./transcript-message";
import { TranscriptSearch } from "./transcript-search";
import { TimelineScrubber, BookmarkMarker } from "./timeline-scrubber";

// ── Types ──────────────────────────────────────────────────────────────────────

interface BookmarkRecord {
  id: string;
  messageIndex: number;
  label?: string;
  note?: string;
}

export interface TranscriptViewerProps {
  /** The session ID to display the transcript for. */
  sessionId: string;
  /**
   * Workspace slug — when provided, enables "Send to Insights" on bookmark pills
   * in the timeline scrubber.
   */
  workspace?: string;
  className?: string;
}

// ── Text content extractor (for search matching) ──────────────────────────────

function extractText(entry: RawSessionEntry): string {
  if (typeof entry.content === "string") return entry.content;
  if (Array.isArray(entry.content)) {
    return entry.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join(" ");
  }
  return entry.summary ?? "";
}

// ── TranscriptViewer ──────────────────────────────────────────────────────────

export function TranscriptViewer({ sessionId, workspace, className }: TranscriptViewerProps) {
  // ── Remote data ────────────────────────────────────────────────────────────
  const messages = useSessionMessages(sessionId);
  const bookmarksQuery = useSessionBookmarks(sessionId);
  const createBookmark = useCreateBookmark(sessionId);
  const deleteBookmark = useDeleteBookmark(sessionId);

  // Insight extraction — only active when a workspace slug is provided
  const extractInsights = useExtractInsights(workspace ?? "");

  /** Flat list of all messages across infinite-query pages. */
  const allMessages = useMemo<RawSessionEntry[]>(
    () => messages.data?.pages.flatMap((p) => p.messages as RawSessionEntry[]) ?? [],
    [messages.data]
  );

  /** Map of messageIndex → bookmark id for O(1) lookup. */
  const bookmarkMap = useMemo<Map<number, string>>(() => {
    const map = new Map<number, string>();
    if (Array.isArray(bookmarksQuery.data)) {
      for (const bm of bookmarksQuery.data as BookmarkRecord[]) {
        map.set(bm.messageIndex, bm.id);
      }
    }
    return map;
  }, [bookmarksQuery.data]);

  /** Bookmark markers for the timeline scrubber. */
  const bookmarkMarkers = useMemo<BookmarkMarker[]>(
    () =>
      Array.isArray(bookmarksQuery.data)
        ? (bookmarksQuery.data as BookmarkRecord[]).map((bm) => ({
            messageIndex: bm.messageIndex,
            label: bm.label,
          }))
        : [],
    [bookmarksQuery.data]
  );

  // ── Search state ───────────────────────────────────────────────────────────
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentMatch, setCurrentMatch] = useState(0);

  /** Sorted list of message indices that contain the current search query. */
  const matchIndices = useMemo<number[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return allMessages.reduce<number[]>((acc, entry, i) => {
      if (extractText(entry).toLowerCase().includes(q)) acc.push(i);
      return acc;
    }, []);
  }, [allMessages, searchQuery]);

  // Clamp currentMatch when the match list shrinks
  useEffect(() => {
    setCurrentMatch((prev) =>
      matchIndices.length === 0 ? 0 : Math.min(prev, matchIndices.length - 1)
    );
  }, [matchIndices.length]);

  const handleSearchChange = useCallback((q: string) => {
    setSearchQuery(q);
    setCurrentMatch(0);
  }, []);

  const handleNextMatch = useCallback(() => {
    if (!matchIndices.length) return;
    setCurrentMatch((prev) => (prev + 1) % matchIndices.length);
  }, [matchIndices.length]);

  const handlePrevMatch = useCallback(() => {
    if (!matchIndices.length) return;
    setCurrentMatch((prev) => (prev - 1 + matchIndices.length) % matchIndices.length);
  }, [matchIndices.length]);

  const handleSearchClose = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery("");
    setCurrentMatch(0);
  }, []);

  // ── Message element refs (shared for timeline tracking & search scroll) ────
  const messageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // ── Scroll to active search match ─────────────────────────────────────────
  const activeMatchIdx = matchIndices[currentMatch];
  useEffect(() => {
    if (activeMatchIdx == null) return;
    messageRefs.current.get(activeMatchIdx)?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [activeMatchIdx, currentMatch]);

  // ── Timeline position tracking via IntersectionObserver ───────────────────
  const [currentPosition, setCurrentPosition] = useState(0);
  const positionObserver = useRef<IntersectionObserver | null>(null);
  const visibleSet = useRef<Set<number>>(new Set());

  /**
   * Lazily creates and returns the position IntersectionObserver.
   * The observer tracks which messages are visible to derive the topmost
   * visible index for the timeline scrubber.
   */
  const getPositionObserver = useCallback((): IntersectionObserver => {
    if (!positionObserver.current) {
      positionObserver.current = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const idx = Number((entry.target as HTMLElement).dataset.messageIndex);
            if (entry.isIntersecting) {
              visibleSet.current.add(idx);
            } else {
              visibleSet.current.delete(idx);
            }
          }
          if (visibleSet.current.size > 0) {
            setCurrentPosition(Math.min(...visibleSet.current));
          }
        },
        // rootMargin hides the bottom 80% of the viewport so only messages
        // near the top of the scroll area update the timeline position.
        { threshold: 0.1, rootMargin: "0px 0px -80% 0px" }
      );
    }
    return positionObserver.current;
  }, []);

  // Disconnect the position observer on unmount
  useEffect(() => () => positionObserver.current?.disconnect(), []);

  /**
   * Callback ref attached to each message wrapper.
   * Observes the element when mounted, unobserves when unmounted.
   */
  const setMessageRef = useCallback(
    (index: number, el: HTMLDivElement | null) => {
      const prev = messageRefs.current.get(index);
      if (prev) positionObserver.current?.unobserve(prev);

      if (el) {
        messageRefs.current.set(index, el);
        getPositionObserver().observe(el);
      } else {
        messageRefs.current.delete(index);
      }
    },
    [getPositionObserver]
  );

  // ── Timeline scrubber change handler ──────────────────────────────────────
  const handleTimelineChange = useCallback((position: number) => {
    setCurrentPosition(position);
    messageRefs.current.get(position)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  // ── Infinite-scroll sentinel ───────────────────────────────────────────────
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (
          entry?.isIntersecting &&
          messages.hasNextPage &&
          !messages.isFetchingNextPage
        ) {
          void messages.fetchNextPage();
        }
      },
      { rootMargin: "300px" }
    );

    io.observe(sentinel);
    return () => io.disconnect();
  }, [messages.hasNextPage, messages.isFetchingNextPage, messages.fetchNextPage]);

  // ── Send bookmark to insight extraction ───────────────────────────────────
  const handleSendToInsights = useCallback(() => {
    if (!workspace) return;
    extractInsights.mutate([sessionId]);
  }, [workspace, sessionId, extractInsights]);

  // ── Bookmark toggle ────────────────────────────────────────────────────────
  const handleBookmark = useCallback(
    (index: number, label: string) => {
      const existingId = bookmarkMap.get(index);
      if (existingId) {
        deleteBookmark.mutate(existingId);
      } else {
        createBookmark.mutate({ messageIndex: index, label });
      }
    },
    [bookmarkMap, createBookmark, deleteBookmark]
  );

  // ── Ctrl+F / Cmd+F shortcut ────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (messages.isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-sf-text-muted" />
      </div>
    );
  }

  if (messages.isError) {
    return (
      <div className="py-8 text-center text-sm text-sf-danger">
        Failed to load transcript. Please try again.
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* ── Timeline scrubber ──────────────────────────────────────────── */}
      <TimelineScrubber
        totalMessages={allMessages.length}
        currentPosition={currentPosition}
        onChange={handleTimelineChange}
        bookmarks={bookmarkMarkers}
        onSendToInsights={workspace ? handleSendToInsights : undefined}
        isSendingInsights={extractInsights.isPending}
      />

      {/* ── Search bar ─────────────────────────────────────────────────── */}
      {searchOpen && (
        <TranscriptSearch
          query={searchQuery}
          onChange={handleSearchChange}
          matchCount={matchIndices.length}
          currentMatch={currentMatch}
          onNext={handleNextMatch}
          onPrev={handlePrevMatch}
          onClose={handleSearchClose}
        />
      )}

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {allMessages.length === 0 && (
        <div className="py-12 text-center text-sm text-sf-text-muted">
          No messages in this session.
        </div>
      )}

      {/* ── Message list ───────────────────────────────────────────────── */}
      <div className="space-y-3">
        {allMessages.map((entry, i) => (
          <div
            key={i}
            ref={(el) => setMessageRef(i, el)}
            data-message-index={i}
          >
            <TranscriptMessage
              entry={entry}
              messageIndex={i}
              isBookmarked={bookmarkMap.has(i)}
              onBookmark={handleBookmark}
              searchQuery={searchQuery}
            />
          </div>
        ))}
      </div>

      {/* ── Infinite-scroll sentinel (triggers next page load) ──────────── */}
      <div ref={sentinelRef} aria-hidden className="h-1" />

      {/* ── Loading more indicator ──────────────────────────────────────── */}
      {messages.isFetchingNextPage && (
        <div className="flex justify-center py-4">
          <Loader2 size={18} className="animate-spin text-sf-text-muted" />
        </div>
      )}
    </div>
  );
}
