"use client";

import { useState } from "react";
import { Sparkles, ArrowUpRight, ArrowDownRight, Eye, Send, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const QUICK_ACTIONS = [
  {
    label: "Make Longer",
    icon: ArrowUpRight,
    message: "Make the post longer. Expand sections with more detail, examples, and explanation. Add substance, not padding. Target ~30% more content.",
  },
  {
    label: "Make Shorter",
    icon: ArrowDownRight,
    message: "Make the post shorter. Condense aggressively. Remove redundancy and filler. Prioritize signal over word count. Target ~30% less content.",
  },
  {
    label: "Improve Clarity",
    icon: Eye,
    message: "Improve the clarity and readability of this post. Simplify complex sentences, improve transitions, and ensure each paragraph has a clear point.",
  },
] as const;

const LENGTH_PRESETS = [
  { label: "Short (~500 words)", target: 500 },
  { label: "Medium (~1500 words)", target: 1500 },
  { label: "Long (~2500 words)", target: 2500 },
] as const;

interface InlineEditControlsProps {
  currentWordCount: number;
  isStreaming: boolean;
  onSendMessage: (msg: string) => void;
}

export function InlineEditControls({ currentWordCount, isStreaming, onSendMessage }: InlineEditControlsProps) {
  const [feedback, setFeedback] = useState("");
  const [lengthOpen, setLengthOpen] = useState(false);
  const [customTarget, setCustomTarget] = useState("");

  function handleLengthPreset(target: number) {
    setLengthOpen(false);
    onSendMessage(
      `Adjust the post to approximately ${target} words. Expand or condense sections as needed to hit this target while preserving all key points. Current word count: ${currentWordCount}.`
    );
  }

  function handleCustomLength() {
    const target = parseInt(customTarget, 10);
    if (!target || target < 50) return;
    setLengthOpen(false);
    setCustomTarget("");
    onSendMessage(
      `Adjust the post to approximately ${target} words. Expand or condense sections as needed to hit this target while preserving all key points. Current word count: ${currentWordCount}.`
    );
  }

  function handleFeedback() {
    const trimmed = feedback.trim();
    if (!trimmed) return;
    setFeedback("");
    onSendMessage(trimmed);
  }

  return (
    <div className="flex items-center gap-2 mb-3 flex-wrap">
      {/* Quick action buttons */}
      {QUICK_ACTIONS.map(({ label, icon: Icon, message }) => (
        <button
          key={label}
          onClick={() => onSendMessage(message)}
          disabled={isStreaming}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-sf border transition-colors",
            "border-sf-border bg-sf-bg-secondary text-sf-text-secondary",
            "hover:border-sf-accent hover:text-sf-accent",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          <Icon size={13} />
          {label}
        </button>
      ))}

      {/* Length preset dropdown */}
      <div className="relative">
        <button
          onClick={() => setLengthOpen((o) => !o)}
          disabled={isStreaming}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-sf border transition-colors",
            "border-sf-border bg-sf-bg-secondary text-sf-text-secondary",
            "hover:border-sf-accent hover:text-sf-accent",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          <Sparkles size={13} />
          Target Length
          <ChevronDown size={12} />
        </button>
        {lengthOpen && (
          <div className="absolute left-0 top-full mt-1 w-52 bg-sf-bg-secondary border border-sf-border rounded-sf-lg shadow-lg z-20 overflow-hidden">
            {LENGTH_PRESETS.map(({ label, target }) => (
              <button
                key={target}
                onClick={() => handleLengthPreset(target)}
                className="w-full text-left px-3 py-2 text-xs text-sf-text-primary hover:bg-sf-bg-tertiary transition-colors"
              >
                {label}
              </button>
            ))}
            <div className="border-t border-sf-border px-3 py-2 flex gap-1.5">
              <input
                type="number"
                value={customTarget}
                onChange={(e) => setCustomTarget(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCustomLength()}
                placeholder="Custom..."
                min={50}
                className="flex-1 bg-sf-bg-tertiary border border-sf-border rounded-sf px-2 py-1 text-xs text-sf-text-primary placeholder:text-sf-text-muted focus:outline-none focus:border-sf-border-focus w-20"
              />
              <button
                onClick={handleCustomLength}
                disabled={!customTarget || parseInt(customTarget, 10) < 50}
                className="px-2 py-1 text-xs bg-sf-accent text-sf-bg-primary rounded-sf disabled:opacity-50"
              >
                Set
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Separator */}
      <div className="w-px h-5 bg-sf-border mx-1 hidden sm:block" />

      {/* Free-text feedback */}
      <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
        <input
          type="text"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleFeedback()}
          placeholder="e.g., Talk more about X, Add section on Y"
          disabled={isStreaming}
          className="flex-1 bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-1.5 text-xs text-sf-text-primary placeholder:text-sf-text-muted focus:outline-none focus:border-sf-border-focus disabled:opacity-50"
        />
        <button
          onClick={handleFeedback}
          disabled={isStreaming || !feedback.trim()}
          aria-label={isStreaming ? "Sending feedback" : "Send feedback"}
          className="p-1.5 bg-sf-accent text-sf-bg-primary rounded-sf hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
        >
          {isStreaming ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
        </button>
      </div>
    </div>
  );
}
