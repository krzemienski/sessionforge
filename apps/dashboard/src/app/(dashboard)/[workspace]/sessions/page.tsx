"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSessions, useScanSessions } from "@/hooks/use-sessions";
import { timeAgo, formatDuration } from "@/lib/utils";
import { useState } from "react";
import { Zap, ScrollText } from "lucide-react";

export default function SessionsPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const router = useRouter();
  const [offset, setOffset] = useState(0);
  const [project, setProject] = useState("");
  const limit = 20;

  const sessions = useSessions(workspace, { limit, offset, project: project || undefined });
  const scan = useScanSessions(workspace);
  const sessionList = sessions.data?.sessions ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-display">Sessions</h1>
        <button
          onClick={() => scan.mutate(30)}
          disabled={scan.isPending}
          className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
        >
          <Zap size={16} />
          {scan.isPending ? "Scanning..." : "Scan Now"}
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Filter by project name..."
          value={project}
          onChange={(e) => { setProject(e.target.value); setOffset(0); }}
          className="bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary placeholder:text-sf-text-muted focus:border-sf-border-focus focus:outline-none w-full max-w-sm"
        />
      </div>

      <div className="space-y-3">
        {sessionList.map((s: any) => (
          <div
            key={s.id}
            onClick={() => router.push(`/${workspace}/sessions/${s.id}`)}
            className="bg-sf-bg-secondary border border-sf-border hover:border-sf-border-focus rounded-sf-lg p-4 cursor-pointer transition-colors border-l-[3px] border-l-sf-accent"
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-sf-text-primary">{s.projectName}</h3>
              <span className="text-xs text-sf-text-muted">{s.startedAt ? timeAgo(s.startedAt) : ""}</span>
            </div>
            <p className="text-xs text-sf-text-secondary mb-2">
              {s.messageCount} messages{s.filesModified?.length ? ` · ${s.filesModified.length} files` : ""}
              {s.toolsUsed?.length ? ` · ${s.toolsUsed.slice(0, 4).join(", ")}` : ""}
              {s.durationSeconds ? ` · ${formatDuration(s.durationSeconds)}` : ""}
            </p>
            {s.summary && (
              <p className="text-sm text-sf-text-secondary truncate">{s.summary}</p>
            )}
          </div>
        ))}

        {sessionList.length === 0 && !sessions.isLoading && (
          <div className="text-center py-12">
            <ScrollText size={40} className="mx-auto text-sf-text-muted mb-3" />
            <p className="text-sf-text-primary font-medium mb-1">No sessions found</p>
            <p className="text-sf-text-secondary mb-6 text-sm">Scan your Claude projects to import sessions and start generating insights.</p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => scan.mutate(30)}
                disabled={scan.isPending}
                className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
              >
                <Zap size={16} />
                {scan.isPending ? "Scanning..." : "Scan Now"}
              </button>
              <Link
                href="/onboarding"
                className="text-sm text-sf-accent hover:text-sf-accent-dim transition-colors"
              >
                View setup guide →
              </Link>
            </div>
          </div>
        )}
      </div>

      {sessionList.length >= limit && (
        <div className="flex justify-center gap-4 mt-6">
          <button
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
            className="px-4 py-2 text-sm bg-sf-bg-tertiary border border-sf-border rounded-sf text-sf-text-secondary hover:bg-sf-bg-hover disabled:opacity-30"
          >
            Prev
          </button>
          <button
            onClick={() => setOffset(offset + limit)}
            className="px-4 py-2 text-sm bg-sf-bg-tertiary border border-sf-border rounded-sf text-sf-text-secondary hover:bg-sf-bg-hover"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
