"use client";

import { useState } from "react";
import { OnboardingTooltip } from "@/components/onboarding/onboarding-tooltip";
import { UploadZone } from "@/components/sessions/upload-zone";

type StepScanPathProps = {
  onNext: (data: { sessionBasePath: string }) => void;
  onBack: () => void;
};

export function StepScanPath({ onNext, onBack }: StepScanPathProps) {
  const [sessionBasePath, setSessionBasePath] = useState("~/.claude");
  const [isUploading, setIsUploading] = useState(false);
  const isCloudDeployment = process.env.NEXT_PUBLIC_DEPLOYMENT_TYPE === "cloud";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionBasePath.trim()) return;
    onNext({ sessionBasePath: sessionBasePath.trim() });
  }

  function handleFilesSelected(files: File[]) {
    setIsUploading(true);
    // For cloud deployment, we'll upload files and skip the path-based scan
    // Mark as complete and move to next step with a placeholder path
    // The actual upload will be handled in the scan step
    setTimeout(() => {
      setIsUploading(false);
      onNext({ sessionBasePath: "cloud-upload" });
    }, 500);
  }

  return (
    <div className="w-full max-w-lg bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-8">
      <p className="text-sf-text-muted text-xs font-medium uppercase tracking-widest mb-6">
        Step 2 of 5
      </p>

      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-xl font-bold text-sf-text-primary">
          {isCloudDeployment ? "Upload your Claude sessions" : "Where are your Claude sessions?"}
        </h2>
        <OnboardingTooltip
          content={
            isCloudDeployment
              ? "Upload your Claude Code session files (.jsonl or .zip) to get started. You can export sessions from your local Claude Code directory."
              : "SessionForge reads the JSONL conversation files that Claude Code saves locally. The default path (~/.claude) is correct for most setups — only change this if you've moved your Claude data directory."
          }
        />
      </div>
      <p className="text-sf-text-secondary text-sm mb-6">
        {isCloudDeployment
          ? "Upload your Claude Code session files to index them in SessionForge. You can upload individual .jsonl files or a .zip archive."
          : "SessionForge scans this directory for Claude Code session files. The default path is where Claude Code stores sessions on your machine."}
      </p>

      {isCloudDeployment ? (
        <div className="space-y-6">
          <UploadZone
            onFilesSelected={handleFilesSelected}
            isUploading={isUploading}
            maxFileSizeMB={50}
          />

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onBack}
              disabled={isUploading}
              className="flex-1 bg-sf-bg-tertiary border border-sf-border text-sf-text-secondary font-medium py-2 rounded-sf hover:border-sf-border-focus hover:text-sf-text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Back
            </button>
          </div>
        </div>
      ) : (
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
      )}
    </div>
  );
}
