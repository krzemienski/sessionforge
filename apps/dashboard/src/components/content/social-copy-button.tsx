"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatTwitterThread,
  formatLinkedIn,
  getTwitterCharCount,
  getLinkedInCharCount,
  TWITTER_CHAR_LIMIT,
  LINKEDIN_CHAR_LIMIT,
} from "@/lib/export";
import { showToast } from "@/components/ui/toast";

interface SocialCopyButtonProps {
  markdown: string;
  contentType: "twitter_thread" | "linkedin_post";
  className?: string;
}

export function SocialCopyButton({
  markdown,
  contentType,
  className,
}: SocialCopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const isTwitter = contentType === "twitter_thread";

  const twitterStats = isTwitter ? getTwitterCharCount(markdown) : null;
  const linkedInCharCount = !isTwitter ? getLinkedInCharCount(markdown) : null;

  function getTwitterCounterColor(chars: number): string {
    if (chars >= TWITTER_CHAR_LIMIT) return "text-sf-danger";
    if (chars >= 260) return "text-sf-warning";
    return "text-sf-success";
  }

  function getLinkedInCounterColor(chars: number): string {
    if (chars >= LINKEDIN_CHAR_LIMIT) return "text-sf-danger";
    if (chars >= 2700) return "text-sf-warning";
    return "text-sf-success";
  }

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    const text = isTwitter
      ? formatTwitterThread(markdown)
      : formatLinkedIn(markdown);
    const platformName = isTwitter ? "Twitter thread" : "LinkedIn post";
    navigator.clipboard
      .writeText(text)
      .then(() => {
        showToast(`${platformName} copied to clipboard`, "success");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        showToast("Failed to copy to clipboard", "error");
      });
  }

  const buttonLabel = isTwitter ? "Copy Twitter Thread" : "Copy LinkedIn Post";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {isTwitter && twitterStats && (
        <span
          className={cn(
            "text-xs font-mono",
            getTwitterCounterColor(twitterStats.longestTweetChars)
          )}
        >
          {twitterStats.tweetCount} tweet{twitterStats.tweetCount !== 1 ? "s" : ""} · longest:{" "}
          {twitterStats.longestTweetChars}/{TWITTER_CHAR_LIMIT} chars
        </span>
      )}

      {!isTwitter && linkedInCharCount !== null && (
        <span
          className={cn(
            "text-xs font-mono",
            getLinkedInCounterColor(linkedInCharCount)
          )}
        >
          {linkedInCharCount}/{LINKEDIN_CHAR_LIMIT} chars
        </span>
      )}

      <button
        onClick={handleCopy}
        className="flex items-center gap-1.5 bg-sf-bg-secondary border border-sf-border text-sf-text-secondary px-3 py-1.5 rounded-sf text-sm font-medium hover:text-sf-text-primary hover:border-sf-border-strong transition-colors"
      >
        {copied ? (
          <Check size={14} className="text-sf-success" />
        ) : (
          <Copy size={14} />
        )}
        {buttonLabel}
      </button>
    </div>
  );
}
