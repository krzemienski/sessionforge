"use client";

import { useParams, useRouter } from "next/navigation";
import { useSession, useSessionMessages } from "@/hooks/use-sessions";
import { useExtractInsights } from "@/hooks/use-insights";
import { formatDuration, timeAgo } from "@/lib/utils";
import { ArrowLeft, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SessionDetailPage() {
  const { workspace, sessionId } = useParams<{ workspace: string; sessionId: string }>();
  const router = useRouter();
  const session = useSession(sessionId);
  const messages = useSessionMessages(sessionId);
  const extract = useExtractInsights(workspace);

  const s = session.data;
  const msgList = messages.data?.pages.flatMap((p) => p.messages) ?? [];

  if (session.isLoading) {
    return <div className="animate-pulse space-y-4"><div className="h-8 bg-sf-bg-tertiary rounded w-1/3" /><div className="h-4 bg-sf-bg-tertiary rounded w-2/3" /></div>;
  }

  if (!s) return <p className="text-sf-text-muted">Session not found.</p>;

  return (
    <div>
      <button onClick={() => router.push(`/${workspace}/sessions`)} className="flex items-center gap-1 text-sf-text-secondary hover:text-sf-text-primary text-sm mb-4">
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
        <button
          onClick={() => extract.mutate([s.id])}
          disabled={extract.isPending}
          className="mt-3 flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
        >
          <Lightbulb size={16} />
          {extract.isPending ? "Extracting..." : "Extract Insights"}
        </button>
      </div>

      {s.toolsUsed?.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {s.toolsUsed.map((tool: string) => (
            <span key={tool} className="px-2 py-0.5 bg-sf-bg-tertiary border border-sf-border rounded-sf-full text-xs text-sf-text-secondary font-code">
              {tool}
            </span>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {msgList.map((msg: any, i: number) => (
          <div
            key={i}
            className={cn(
              "p-3 rounded-sf-lg text-sm",
              msg.role === "human"
                ? "bg-sf-bg-tertiary ml-0 mr-12"
                : "bg-sf-bg-secondary border border-sf-border"
            )}
          >
            <span className="text-xs text-sf-text-muted mb-1 block">
              {msg.role === "human" ? "You" : "Assistant"}
              {msg.timestamp && ` · ${timeAgo(msg.timestamp)}`}
            </span>
            <p className="text-sf-text-primary whitespace-pre-wrap break-words">
              {typeof msg.content === "string" ? msg.content.slice(0, 500) : JSON.stringify(msg.content).slice(0, 500)}
              {(typeof msg.content === "string" ? msg.content.length : JSON.stringify(msg.content).length) > 500 && "..."}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
