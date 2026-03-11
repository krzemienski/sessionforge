"use client";

import { useState, useRef, useEffect } from "react";
import { Wand2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { showToast } from "@/components/ui/toast";
import { BatchRepurposeDialog } from "./batch-repurpose-dialog";
import { useRepurpose, type TargetFormat } from "@/hooks/use-repurpose";

interface RepurposeButtonProps {
  postId: string;
  contentType: string;
  workspaceSlug: string;
}

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
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const repurpose = useRepurpose();

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
    setOpen(false);

    showToast(`Repurposing to ${FORMAT_LABELS[targetFormat]}...`, "info");

    // Use the hook to run the repurpose operation
    await repurpose.run({
      workspaceSlug,
      sourcePostId: postId,
      targetFormat,
    });

    if (repurpose.status === "completed") {
      showToast(`${FORMAT_LABELS[targetFormat]} created successfully`, "success");
      setTimeout(() => window.location.reload(), 1000);
    } else if (repurpose.error) {
      showToast(repurpose.error, "error");
    }
  }

  if (availableFormats.length === 0) {
    return null;
  }

  return (
    <>
      <div ref={containerRef} className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setOpen((prev) => !prev);
          }}
          disabled={repurpose.status === "running" || repurpose.status === "retrying"}
          className={cn(
            "flex items-center gap-1.5 bg-sf-bg-secondary border border-sf-border text-sf-text-secondary px-3 py-1.5 rounded-sf text-sm font-medium hover:text-sf-text-primary hover:border-sf-border-strong transition-colors",
            (repurpose.status === "running" || repurpose.status === "retrying") && "opacity-50 cursor-not-allowed"
          )}
        >
          <Wand2 size={14} />
          {repurpose.status === "running" || repurpose.status === "retrying" ? "Repurposing..." : "Repurpose"}
          <ChevronDown
            size={14}
            className={cn("transition-transform duration-150", open && "rotate-180")}
          />
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1 z-20 bg-sf-bg-secondary border border-sf-border rounded-sf-lg shadow-[var(--shadow-sf-lg)] py-1 min-w-[180px]">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                setShowBatchDialog(true);
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-sf-accent hover:bg-sf-bg-tertiary transition-colors text-left border-b border-sf-border"
            >
              <Wand2 size={14} />
              Batch Repurpose...
            </button>
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

      <BatchRepurposeDialog
        postId={postId}
        workspace={workspaceSlug}
        contentType={contentType}
        isOpen={showBatchDialog}
        onClose={() => setShowBatchDialog(false)}
      />
    </>
  );
}
