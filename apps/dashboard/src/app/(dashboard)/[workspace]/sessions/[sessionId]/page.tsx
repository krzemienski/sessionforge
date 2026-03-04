"use client";

import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/hooks/use-sessions";
import { useExtractInsights } from "@/hooks/use-insights";
import { formatDuration } from "@/lib/utils";
import { ArrowLeft, Lightbulb, X } from "lucide-react";
import { TranscriptViewer } from "@/components/transcript/transcript-viewer";

export default function SessionDetailPage() {
  const { workspace, sessionId } = useParams<{ workspace: string; sessionId: string }>();
  const router = useRouter();
  const session = useSession(sessionId);
  const extract = useExtractInsights(workspace);

  const s = session.data;

  if (session.isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-sf-bg-tertiary rounded w-1/3" />
        <div className="h-4 bg-sf-bg-tertiary rounded w-2/3" />
      </div>
    );
  }

  if (!s) return <p className="text-sf-text-muted">Session not found.</p>;

  const hasActivity = extract.isExtracting || extract.events.length > 0 || extract.error;

  return (
    <div>
      <button
        onClick={() => router.push(`/${workspace}/sessions`)}
        className="flex items-center gap-1 text-sf-text-secondary hover:text-sf-text-primary text-sm mb-4"
      >
        <ArrowLeft size={16} /> Sessions
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold font-display mb-2">{s.projectName}</h1>
        <p className="text-sm text-sf-text-secondary">
          {s.messageCount} messages
          {s.filesModified?.length ? ` · ${s.filesModified.length} files modified` : ""}
          {s.durationSeconds ? ` · Duration: ${formatDuration(s.durationSeconds)}` : ""}
          {s.costUsd ? ` · Cost: $${s.costUsd.toFixed(2)}` : ""}
        </p>
        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={() => extract.mutate([s.id])}
            disabled={extract.isPending}
            className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
          >
            <Lightbulb size={16} />
            {extract.isPending ? "Extracting..." : "Extract Insights"}
          </button>
          {extract.isPending && (
            <button
              onClick={extract.cancel}
              className="text-xs text-sf-text-muted hover:text-sf-text-secondary"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Live Agent Output Panel */}
      {hasActivity && (
        <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg mb-6 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-sf-border">
            <span className="text-sm font-medium text-sf-text-primary flex items-center gap-2">
              <Lightbulb size={14} className="text-sf-accent" />
              Agent Output
              {extract.isExtracting && (
                <span className="inline-block w-2 h-2 bg-sf-accent rounded-full animate-pulse" />
              )}
            </span>
            {!extract.isExtracting && extract.events.length > 0 && (
              <button
                onClick={() => {
                  // Reset is handled by next mutate call
                }}
                className="text-sf-text-muted hover:text-sf-text-secondary"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="px-4 py-3 max-h-80 overflow-y-auto font-code text-xs space-y-1">
            {extract.events.map((evt, i) => {
              switch (evt.type) {
                case "status":
                  return (
                    <div key={i} className="text-sf-accent">
                      ● {(evt as { message?: string }).message}
                    </div>
                  );
                case "tool_use":
                  return (
                    <div key={i} className="text-yellow-400">
                      → Tool: {(evt as { tool?: string }).tool}
                    </div>
                  );
                case "tool_result":
                  return (
                    <div key={i} className="text-sf-text-muted">
                      ← {(evt as { tool?: string }).tool} returned
                    </div>
                  );
                case "text":
                  return (
                    <div key={i} className="text-sf-text-secondary whitespace-pre-wrap">
                      {(evt as { content?: string }).content}
                    </div>
                  );
                case "complete":
                  return (
                    <div key={i} className="text-green-400 font-medium">
                      ✓ {(evt as { message?: string }).message}
                    </div>
                  );
                case "error":
                  return (
                    <div key={i} className="text-red-400">
                      ✗ {(evt as { message?: string }).message}
                    </div>
                  );
                default:
                  return null;
              }
            })}
            {extract.isExtracting && extract.events.length === 0 && (
              <div className="text-sf-text-muted animate-pulse">
                Connecting to agent...
              </div>
            )}
          </div>
          {extract.error && (
            <div className="px-4 py-2 border-t border-sf-border bg-red-500/10 text-xs text-red-400">
              {extract.error}
            </div>
          )}
        </div>
      )}

      {s.toolsUsed?.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {s.toolsUsed.map((tool: string) => (
            <span
              key={tool}
              className="px-2 py-0.5 bg-sf-bg-tertiary border border-sf-border rounded-sf-full text-xs text-sf-text-secondary font-code"
            >
              {tool}
            </span>
          ))}
        </div>
      )}

      <TranscriptViewer sessionId={sessionId} workspace={workspace} />
    </div>
  );
}
