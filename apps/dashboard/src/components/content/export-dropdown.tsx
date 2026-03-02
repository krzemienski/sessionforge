"use client";

import { useState, useRef, useEffect } from "react";
import { Download, ChevronDown, FileText, Code, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { markdownToHtml, downloadMarkdownFile } from "@/lib/export";
import { showToast } from "@/components/ui/toast";

interface ExportDropdownProps {
  markdown: string;
  title: string;
}

export function ExportDropdown({ markdown, title }: ExportDropdownProps) {
  const [open, setOpen] = useState(false);
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

  function handleCopyMarkdown(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard
      .writeText(markdown)
      .then(() => {
        showToast("Markdown copied to clipboard", "success");
        setOpen(false);
      })
      .catch(() => {
        showToast("Failed to copy to clipboard", "error");
      });
  }

  function handleCopyHtml(e: React.MouseEvent) {
    e.stopPropagation();
    const html = markdownToHtml(markdown);
    navigator.clipboard
      .writeText(html)
      .then(() => {
        showToast("HTML copied to clipboard", "success");
        setOpen(false);
      })
      .catch(() => {
        showToast("Failed to copy to clipboard", "error");
      });
  }

  function handleDownload(e: React.MouseEvent) {
    e.stopPropagation();
    downloadMarkdownFile(title, markdown);
    showToast("Download started", "success");
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className="flex items-center gap-1.5 bg-sf-bg-secondary border border-sf-border text-sf-text-secondary px-3 py-1.5 rounded-sf text-sm font-medium hover:text-sf-text-primary hover:border-sf-border-strong transition-colors"
      >
        <Download size={14} />
        Export
        <ChevronDown
          size={14}
          className={cn("transition-transform duration-150", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 bg-sf-bg-secondary border border-sf-border rounded-sf-lg shadow-[var(--shadow-sf-lg)] py-1 min-w-[180px]">
          <button
            onClick={handleCopyMarkdown}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-sf-text-secondary hover:text-sf-text-primary hover:bg-sf-bg-tertiary transition-colors text-left"
          >
            <Copy size={14} className="flex-shrink-0" />
            Copy Markdown
          </button>
          <button
            onClick={handleCopyHtml}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-sf-text-secondary hover:text-sf-text-primary hover:bg-sf-bg-tertiary transition-colors text-left"
          >
            <Code size={14} className="flex-shrink-0" />
            Copy HTML
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-sf-text-secondary hover:text-sf-text-primary hover:bg-sf-bg-tertiary transition-colors text-left"
          >
            <FileText size={14} className="flex-shrink-0" />
            Download .md
          </button>
        </div>
      )}
    </div>
  );
}
