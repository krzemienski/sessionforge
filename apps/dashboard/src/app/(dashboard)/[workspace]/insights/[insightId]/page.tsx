"use client";

import { useParams, useRouter } from "next/navigation";
import { useInsight } from "@/hooks/use-insights";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const DIMS = [
  { key: "noveltyScore", label: "Novel Problem-Solving", weight: "3x" },
  { key: "toolPatternScore", label: "Tool/Pattern Discovery", weight: "3x" },
  { key: "transformationScore", label: "Before/After Transform", weight: "2x" },
  { key: "failureRecoveryScore", label: "Failure + Recovery", weight: "3x" },
  { key: "reproducibilityScore", label: "Reproducibility", weight: "1x" },
  { key: "scaleScore", label: "Scale/Performance", weight: "1x" },
];

export default function InsightDetailPage() {
  const { workspace, insightId } = useParams<{ workspace: string; insightId: string }>();
  const router = useRouter();
  const insight = useInsight(insightId);
  const ins = insight.data;

  if (insight.isLoading) {
    return <div className="animate-pulse space-y-4"><div className="h-8 bg-sf-bg-tertiary rounded w-1/3" /></div>;
  }

  if (!ins) return <p className="text-sf-text-muted">Insight not found.</p>;

  return (
    <div>
      <button onClick={() => router.push(`/${workspace}/insights`)} className="flex items-center gap-1 text-sf-text-secondary hover:text-sf-text-primary text-sm mb-4">
        <ArrowLeft size={16} /> Insights
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold font-display mb-2">{ins.title}</h1>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-sf-accent-bg text-sf-accent rounded-sf-full text-lg font-bold font-display">
            {ins.compositeScore?.toFixed(0) ?? 0}/65
          </span>
          <span className="text-sm text-sf-text-secondary capitalize">{ins.category?.replace(/_/g, " ")}</span>
        </div>
      </div>

      <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4 mb-6">
        <p className="text-sf-text-primary whitespace-pre-wrap">{ins.description}</p>
      </div>

      <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4 mb-6">
        <h2 className="text-lg font-semibold font-display mb-3">Dimension Scores</h2>
        <div className="space-y-3">
          {DIMS.map((dim) => {
            const score = ins[dim.key] || 0;
            return (
              <div key={dim.key}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-sf-text-secondary">{dim.label} <span className="text-sf-text-muted">({dim.weight})</span></span>
                  <span className="text-sf-text-primary font-display">{score}/5</span>
                </div>
                <div className="h-2 bg-sf-bg-tertiary rounded-full overflow-hidden">
                  <div className="h-full bg-sf-accent rounded-full transition-all" style={{ width: `${(score / 5) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {ins.codeSnippets?.length > 0 && (
        <div className="space-y-4 mb-6">
          <h2 className="text-lg font-semibold font-display">Code Snippets</h2>
          {ins.codeSnippets.map((snip: any, i: number) => (
            <div key={i} className="bg-sf-bg-tertiary border border-sf-border rounded-sf-lg overflow-hidden">
              {snip.context && <p className="text-xs text-sf-text-muted px-4 py-2 border-b border-sf-border">{snip.context}</p>}
              <pre className="p-4 overflow-x-auto text-sm font-code text-sf-accent"><code>{snip.code}</code></pre>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => {
            fetch("/api/agents/blog", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ insightId: ins.id, tone: "technical", workspaceSlug: workspace }),
            });
            router.push(`/${workspace}/content`);
          }}
          className="bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors"
        >
          Generate Blog Post
        </button>
        <button
          onClick={() => {
            fetch("/api/agents/social", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ insightId: ins.id, platform: "twitter", workspaceSlug: workspace }),
            });
            router.push(`/${workspace}/content`);
          }}
          className="bg-sf-bg-tertiary border border-sf-border text-sf-text-primary px-4 py-2 rounded-sf text-sm hover:bg-sf-bg-hover transition-colors"
        >
          Generate Twitter Thread
        </button>
      </div>
    </div>
  );
}
