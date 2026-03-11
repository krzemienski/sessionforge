"use client";

import { Loader2, Zap, CheckCircle, AlertCircle } from "lucide-react";
import { useOnboardingScan } from "@/hooks/use-onboarding";
import { OnboardingTooltip } from "@/components/onboarding/onboarding-tooltip";

type StepFirstScanProps = {
  workspaceSlug: string;
  onNext: (sessionsFound: number) => void;
  onBack: () => void;
};

export function StepFirstScan({
  workspaceSlug,
  onNext,
  onBack,
}: StepFirstScanProps) {
  const { status, progress, totalFiles, currentFile, result, error, startScan } =
    useOnboardingScan();

  const progressPercent =
    totalFiles > 0 ? Math.round((progress / totalFiles) * 100) : 0;

  return (
    <div className="w-full max-w-lg bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-8">
      <p className="text-sf-text-muted text-xs font-medium uppercase tracking-widest mb-6">
        Step 3 of 4
      </p>

      {status === "idle" && (
        <>
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-xl font-bold text-sf-text-primary">
              Scan your sessions
            </h2>
            <OnboardingTooltip content="The scan reads your local Claude Code JSONL files and indexes them in SessionForge. No data leaves your machine — everything is stored in your local database." />
          </div>
          <p className="text-sf-text-secondary text-sm mb-8">
            SessionForge will scan your Claude Code session files and index them
            so you can extract insights and generate content.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onBack}
              className="flex-1 bg-sf-bg-tertiary border border-sf-border text-sf-text-secondary font-medium py-2 rounded-sf hover:border-sf-border-focus hover:text-sf-text-primary transition-colors"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => startScan(workspaceSlug)}
              className="flex-1 flex items-center justify-center gap-2 bg-sf-accent text-sf-bg-primary font-medium py-2 rounded-sf hover:bg-sf-accent-dim transition-colors"
            >
              <Zap size={16} />
              Start Scan
            </button>
          </div>
        </>
      )}

      {status === "scanning" && (
        <>
          <div className="flex items-center gap-3 mb-6">
            <Loader2 size={20} className="text-sf-accent animate-spin shrink-0" />
            <h2 className="text-xl font-bold text-sf-text-primary">
              Scanning sessions…
            </h2>
          </div>

          <div className="mb-3">
            <div className="h-2 bg-sf-bg-tertiary rounded-full overflow-hidden">
              <div
                className="h-full bg-sf-accent rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <p className="text-sm text-sf-text-secondary mb-1">
            {totalFiles > 0
              ? `Scanning ${progress} of ${totalFiles}`
              : "Discovering session files…"}
          </p>
          {currentFile && (
            <p className="text-xs text-sf-text-muted font-code truncate">
              {currentFile}
            </p>
          )}
        </>
      )}

      {status === "complete" && result && (
        <>
          <div className="flex items-center gap-3 mb-6">
            <CheckCircle size={20} className="text-sf-accent shrink-0" />
            <h2 className="text-xl font-bold text-sf-text-primary">
              Scan complete!
            </h2>
          </div>

          <div className="bg-sf-bg-tertiary border border-sf-border rounded-sf p-4 mb-8 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-sf-text-secondary">Files scanned</span>
              <span className="text-sf-text-primary font-medium">
                {result.scanned}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-sf-text-secondary">Sessions indexed</span>
              <span className="text-sf-text-primary font-medium">
                {result.indexed}
              </span>
            </div>
            {result.errors > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-sf-text-secondary">Errors</span>
                <span className="text-sf-text-muted">{result.errors}</span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onNext(result.indexed)}
            className="w-full bg-sf-accent text-sf-bg-primary font-medium py-2 rounded-sf hover:bg-sf-accent-dim transition-colors"
          >
            Continue
          </button>
        </>
      )}

      {status === "error" && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle size={20} className="text-red-400 shrink-0" />
            <h2 className="text-xl font-bold text-sf-text-primary">
              Scan failed
            </h2>
          </div>

          {error && (
            <p className="text-sm text-sf-text-secondary mb-8 bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 font-code">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onBack}
              className="flex-1 bg-sf-bg-tertiary border border-sf-border text-sf-text-secondary font-medium py-2 rounded-sf hover:border-sf-border-focus hover:text-sf-text-primary transition-colors"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => startScan(workspaceSlug)}
              className="flex-1 flex items-center justify-center gap-2 bg-sf-accent text-sf-bg-primary font-medium py-2 rounded-sf hover:bg-sf-accent-dim transition-colors"
            >
              <Zap size={16} />
              Try Again
            </button>
          </div>
        </>
      )}
    </div>
  );
}
