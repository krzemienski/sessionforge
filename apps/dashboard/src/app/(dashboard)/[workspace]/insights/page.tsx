"use client";

import { useParams, useRouter } from "next/navigation";
import { useInsights } from "@/hooks/use-insights";
import { useState } from "react";
import { Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORIES: Record<string, { label: string; color: string }> = {
  novel_problem_solving: { label: "Novel", color: "text-purple-400 bg-purple-400/10" },
  tool_pattern_discovery: { label: "Tool Pattern", color: "text-blue-400 bg-blue-400/10" },
  before_after_transformation: { label: "Transform", color: "text-green-400 bg-green-400/10" },
  failure_recovery: { label: "Recovery", color: "text-red-400 bg-red-400/10" },
  architecture_decision: { label: "Architecture", color: "text-yellow-400 bg-yellow-400/10" },
  performance_optimization: { label: "Performance", color: "text-cyan-400 bg-cyan-400/10" },
};

export default function InsightsPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const router = useRouter();
  const [minScore, setMinScore] = useState(0);
  const insights = useInsights(workspace, { limit: 50, minScore: minScore || undefined });
  const insightList = insights.data?.insights ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-display">Insights</h1>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <label className="text-sm text-sf-text-secondary">Min Score:</label>
        <input
          type="range"
          min={0}
          max={65}
          value={minScore}
          onChange={(e) => setMinScore(Number(e.target.value))}
          className="accent-sf-accent"
        />
        <span className="text-sm text-sf-text-primary font-display w-8">{minScore}</span>
      </div>

      <div className="space-y-3">
        {insightList.map((ins: any) => {
          const cat = CATEGORIES[ins.category] ?? { label: ins.category, color: "text-sf-text-secondary bg-sf-bg-tertiary" };
          return (
            <div
              key={ins.id}
              onClick={() => router.push(`/${workspace}/insights/${ins.id}`)}
              className="bg-sf-bg-secondary border border-sf-border hover:border-sf-border-focus rounded-sf-lg p-4 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={cn("px-2 py-0.5 rounded-sf-full text-xs font-medium", cat.color)}>{cat.label}</span>
                <span className="ml-auto px-3 py-0.5 bg-sf-accent-bg text-sf-accent rounded-sf-full text-sm font-bold font-display">
                  {ins.compositeScore?.toFixed(0) ?? 0}/65
                </span>
              </div>
              <h3 className="font-semibold text-sf-text-primary mb-1">{ins.title}</h3>
              <p className="text-sm text-sf-text-secondary line-clamp-2">{ins.description}</p>
              <div className="flex gap-1 mt-3">
                {[
                  { score: ins.noveltyScore, w: 3 },
                  { score: ins.toolPatternScore, w: 3 },
                  { score: ins.transformationScore, w: 2 },
                  { score: ins.failureRecoveryScore, w: 3 },
                  { score: ins.reproducibilityScore, w: 1 },
                  { score: ins.scaleScore, w: 1 },
                ].map((d, i) => (
                  <div key={i} className="h-2 flex-1 bg-sf-bg-tertiary rounded-full overflow-hidden">
                    <div className="h-full bg-sf-accent rounded-full" style={{ width: `${((d.score || 0) / 5) * 100}%` }} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {insightList.length === 0 && !insights.isLoading && (
          <div className="text-center py-12">
            <Lightbulb size={40} className="mx-auto text-sf-text-muted mb-3" />
            <p className="text-sf-text-secondary">No insights yet. Extract insights from your sessions first.</p>
          </div>
        )}
      </div>
    </div>
  );
}
