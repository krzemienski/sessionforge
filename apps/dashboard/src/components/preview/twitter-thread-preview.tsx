"use client";

import { cn } from "@/lib/utils";

const TWEET_CHAR_LIMIT = 280;

// --- parsing ---

function parseTweets(markdown: string): string[] {
  // Split on '---' that appears on its own line (with optional surrounding whitespace)
  const raw = markdown.split(/^[ \t]*---[ \t]*$/m);
  return raw
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

// --- sub-components ---

interface TweetCardProps {
  text: string;
  index: number;
  total: number;
}

function TweetCard({ text, index, total }: TweetCardProps) {
  const charCount = text.length;
  const isOverLimit = charCount > TWEET_CHAR_LIMIT;

  return (
    <div className="rounded-sf-lg border border-sf-border bg-sf-bg-secondary p-4 transition-colors hover:border-sf-border-focus">
      {/* Header: avatar + handle + thread position */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Avatar placeholder */}
          <div className="h-10 w-10 flex-shrink-0 rounded-full bg-sf-bg-tertiary border border-sf-border" />
          {/* Handle placeholder */}
          <div className="flex flex-col gap-1">
            <div className="h-3 w-24 rounded-full bg-sf-bg-tertiary" />
            <div className="h-2.5 w-16 rounded-full bg-sf-bg-active" />
          </div>
        </div>
        {/* Thread position indicator */}
        <span className="font-display text-xs text-sf-text-muted">
          {index + 1}/{total}
        </span>
      </div>

      {/* Tweet text */}
      <p className="mb-3 text-sm leading-relaxed text-sf-text-primary whitespace-pre-wrap break-words">
        {text}
      </p>

      {/* Footer: character count badge */}
      <div className="flex items-center justify-end">
        <span
          className={cn(
            "rounded-sf-full px-2 py-0.5 font-code text-xs font-medium tabular-nums",
            isOverLimit
              ? "bg-sf-danger/15 text-sf-danger"
              : "bg-sf-bg-tertiary text-sf-text-muted"
          )}
        >
          {charCount}/{TWEET_CHAR_LIMIT}
        </span>
      </div>
    </div>
  );
}

// --- TwitterThreadPreview ---

export interface TwitterThreadPreviewProps {
  markdown: string;
}

export function TwitterThreadPreview({ markdown }: TwitterThreadPreviewProps) {
  const tweets = parseTweets(markdown);

  if (tweets.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-sf-text-muted">
          No tweets yet. Separate tweets with{" "}
          <code className="rounded bg-sf-bg-tertiary px-1.5 py-0.5 font-code text-[0.8125rem] text-sf-accent">
            ---
          </code>{" "}
          on its own line.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-lg space-y-3 p-6">
        {/* Thread header */}
        <div className="mb-4 flex items-center gap-2">
          <span className="font-display text-xs font-semibold text-sf-text-secondary uppercase tracking-wide">
            Thread Preview
          </span>
          <span className="rounded-sf-full bg-sf-bg-tertiary px-2 py-0.5 font-code text-xs text-sf-text-muted">
            {tweets.length} {tweets.length === 1 ? "tweet" : "tweets"}
          </span>
        </div>

        {/* Tweet cards with connecting line */}
        <div className="relative">
          {tweets.length > 1 && (
            <div
              className="absolute left-[19px] top-[44px] w-px bg-sf-border"
              style={{ height: `calc(100% - 44px - 16px)` }}
            />
          )}
          <div className="space-y-3">
            {tweets.map((tweet, i) => (
              <TweetCard key={i} text={tweet} index={i} total={tweets.length} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
