"use client";

import { useState, useRef, useEffect } from "react";
import { Wand2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { showToast } from "@/components/ui/toast";

interface RepurposeButtonProps {
  postId: string;
  contentType: string;
  workspaceSlug: string;
}

type TargetFormat = "twitter_thread" | "linkedin_post" | "changelog" | "tldr" | "blog_post";

const FORMAT_LABELS: Record<TargetFormat, string> = {
  twitter_thread: "Twitter Thread",
  linkedin_post: "LinkedIn Post",
  changelog: "Changelog Entry",
  tldr: "TL;DR Summary",
  blog_post: "Blog Post",
};

function getAvailableFormats(contentType: string): TargetFormat[] {
  // Social posts can be expanded to blog posts
  if (contentType === "twitter_thread" || contentType === "linkedin_post") {
    return ["blog_post"];
  }

  // Blog posts can be repurposed to social formats
  if (contentType === "blog_post") {
    return ["twitter_thread", "linkedin_post", "changelog", "tldr"];
  }

  // Changelog can be repurposed to social
  if (contentType === "changelog") {
    return ["twitter_thread", "linkedin_post", "tldr"];
  }

  // Default: allow all social formats
  return ["twitter_thread", "linkedin_post", "changelog", "tldr"];
}

export function RepurposeButton({ postId, contentType, workspaceSlug }: RepurposeButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const availableFormats = getAvailableFormats(contentType);

  async function handleRepurpose(targetFormat: TargetFormat, e: React.MouseEvent) {
    e.stopPropagation();
    setLoading(true);
    setOpen(false);

    try {
      const response = await fetch(`/api/agents/repurpose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceSlug,
          sourcePostId: postId,
          targetFormat,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Repurpose failed");
      }

      showToast(`Repurposing to ${FORMAT_LABELS[targetFormat]}...`, "success");

      // The response is a stream, so we'll wait for it to complete
      const reader = response.body?.getReader();
      if (reader) {
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      }

      showToast(`${FORMAT_LABELS[targetFormat]} created successfully`, "success");

      // Reload the page to show the new post in the tracker
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to repurpose content",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }

  if (availableFormats.length === 0) {
    return null;
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        disabled={loading}
        className={cn(
          "flex items-center gap-1.5 bg-sf-bg-secondary border border-sf-border text-sf-text-secondary px-3 py-1.5 rounded-sf text-sm font-medium hover:text-sf-text-primary hover:border-sf-border-strong transition-colors",
          loading && "opacity-50 cursor-not-allowed"
        )}
      >
        <Wand2 size={14} />
        {loading ? "Repurposing..." : "Repurpose"}
        <ChevronDown
          size={14}
          className={cn("transition-transform duration-150", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 bg-sf-bg-secondary border border-sf-border rounded-sf-lg shadow-[var(--shadow-sf-lg)] py-1 min-w-[180px]">
          {availableFormats.map((format) => (
            <button
              key={format}
              onClick={(e) => handleRepurpose(format, e)}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-sf-text-secondary hover:text-sf-text-primary hover:bg-sf-bg-tertiary transition-colors text-left"
            >
              {FORMAT_LABELS[format]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
