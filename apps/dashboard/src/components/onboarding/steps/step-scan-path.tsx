"use client";

import { useState } from "react";
import { OnboardingTooltip } from "@/components/onboarding/onboarding-tooltip";

type StepScanPathProps = {
  onNext: (data: { sessionBasePath: string }) => void;
  onBack: () => void;
};

export function StepScanPath({ onNext, onBack }: StepScanPathProps) {
  const [sessionBasePath, setSessionBasePath] = useState("~/.claude");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionBasePath.trim()) return;
    onNext({ sessionBasePath: sessionBasePath.trim() });
  }

  return (
    <div className="w-full max-w-lg bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-8">
      <p className="text-sf-text-muted text-xs font-medium uppercase tracking-widest mb-6">
        Step 2 of 5
      </p>

      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-xl font-bold text-sf-text-primary">
          Where are your Claude sessions?
        </h2>
        <OnboardingTooltip content="SessionForge reads the JSONL conversation files that Claude Code saves locally. The default path (~/.claude) is correct for most setups — only change this if you've moved your Claude data directory." />
      </div>
      <p className="text-sf-text-secondary text-sm mb-6">
        SessionForge scans this directory for Claude Code session files. The
        default path is where Claude Code stores sessions on your machine.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm text-sf-text-secondary mb-1">
            Session base path
          </label>
          <input
            type="text"
            value={sessionBasePath}
            onChange={(e) => setSessionBasePath(e.target.value)}
            className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sf-text-primary font-code placeholder:text-sf-text-muted focus:border-sf-border-focus focus:outline-none"
            placeholder="~/.claude"
            autoFocus
          />
          <p className="text-xs text-sf-text-muted mt-2">
            Claude Code stores sessions in{" "}
            <span className="font-code text-sf-text-secondary">
              ~/.claude/projects/
            </span>{" "}
            by default. Leave as{" "}
            <span className="font-code text-sf-text-secondary">~/.claude</span>{" "}
            unless you&apos;ve customised your Claude Code data directory.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 bg-sf-bg-tertiary border border-sf-border text-sf-text-secondary font-medium py-2 rounded-sf hover:border-sf-border-focus hover:text-sf-text-primary transition-colors"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={!sessionBasePath.trim()}
            className="flex-1 bg-sf-accent text-sf-bg-primary font-medium py-2 rounded-sf hover:bg-sf-accent-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        </div>
      </form>
    </div>
  );
}
