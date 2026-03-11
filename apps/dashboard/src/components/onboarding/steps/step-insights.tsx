"use client";

import { Lightbulb, Loader2 } from "lucide-react";
import { useInsights } from "@/hooks/use-insights";
import { cn } from "@/lib/utils";
import { OnboardingTooltip } from "@/components/onboarding/onboarding-tooltip";

const CATEGORIES: Record<string, { label: string; color: string }> = {
  novel_problem_solving: { label: "Novel", color: "text-purple-400 bg-purple-400/10" },
  tool_pattern_discovery: { label: "Tool Pattern", color: "text-blue-400 bg-blue-400/10" },
  before_after_transformation: { label: "Transform", color: "text-green-400 bg-green-400/10" },
  failure_recovery: { label: "Recovery", color: "text-red-400 bg-red-400/10" },
  architecture_decision: { label: "Architecture", color: "text-yellow-400 bg-yellow-400/10" },
  performance_optimization: { label: "Performance", color: "text-cyan-400 bg-cyan-400/10" },
};

type StepInsightsProps = {
  workspaceSlug: string;
  onComplete: () => void;
  onBack: () => void;
};

export function StepInsights({
  workspaceSlug,
  onComplete,
  onBack,
}: StepInsightsProps) {
  const insights = useInsights(workspaceSlug, { limit: 5 });
  const insightList = insights.data?.insights ?? [];

  return (
    <div className="w-full max-w-lg bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-8">
      <p className="text-sf-text-muted text-xs font-medium uppercase tracking-widest mb-6">
        Step 4 of 4
      </p>

      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-xl font-bold text-sf-text-primary">
          Your first insights
        </h2>
        <OnboardingTooltip content="Insights are patterns, decisions, and techniques automatically extracted from your sessions. Each insight is scored by novelty and impact — higher scores mean more share-worthy content." />
      </div>
      <p className="text-sf-text-secondary text-sm mb-6">
        SessionForge has extracted these insights from your sessions. Each one
        captures a pattern, decision, or technique worth remembering.
      </p>

      <div className="space-y-3 mb-8">
        {insights.isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="text-sf-accent animate-spin" />
          </div>
        )}

        {!insights.isLoading && insightList.length === 0 && (
          <div className="text-center py-8">
            <Lightbulb size={32} className="mx-auto text-sf-text-muted mb-3" />
            <p className="text-sm text-sf-text-secondary">
              No insights extracted yet. You can extract insights from your
              sessions in the Insights tab.
            </p>
          </div>
        )}

        {insightList.map((ins: any) => {
          const cat =
            CATEGORIES[ins.category] ?? {
              label: ins.category,
              color: "text-sf-text-secondary bg-sf-bg-tertiary",
            };
          return (
            <div
              key={ins.id}
              className="bg-sf-bg-tertiary border border-sf-border rounded-sf p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-sf-full text-xs font-medium",
                    cat.color
                  )}
                >
                  {cat.label}
                </span>
                <span className="ml-auto px-3 py-0.5 bg-sf-accent-bg text-sf-accent rounded-sf-full text-xs font-bold font-display">
                  {ins.compositeScore?.toFixed(0) ?? 0}/65
                </span>
              </div>
              <h3 className="font-semibold text-sf-text-primary text-sm mb-1">
                {ins.title}
              </h3>
              <p className="text-xs text-sf-text-secondary line-clamp-2">
                {ins.description}
              </p>
            </div>
          );
        })}
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
          type="button"
          onClick={onComplete}
          className="flex-1 bg-sf-accent text-sf-bg-primary font-medium py-2 rounded-sf hover:bg-sf-accent-dim transition-colors"
        >
          Finish Setup
        </button>
      </div>
    </div>
  );
}
