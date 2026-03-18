"use client";

import { Lightbulb, Loader2, ExternalLink, AlertCircle, Sparkles } from "lucide-react";
import { useInsights } from "@/hooks/use-insights";
import { useGenerateFormats } from "@/hooks/use-generate";
import { cn } from "@/lib/utils";
import { OnboardingTooltip } from "@/components/onboarding/onboarding-tooltip";

type StepGeneratePostProps = {
  workspaceSlug: string;
  onComplete: () => void;
  onBack: () => void;
};

export function StepGeneratePost({
  workspaceSlug,
  onComplete,
  onBack,
}: StepGeneratePostProps) {
  const insights = useInsights(workspaceSlug, { limit: 10 });
  const insightList = insights.data?.insights ?? [];

  // Pick top-scored insight
  const topInsight = insightList.length > 0
    ? [...insightList].sort(
        (a: any, b: any) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0)
      )[0]
    : null;

  const { statuses, postIds, generateFormats } = useGenerateFormats(
    workspaceSlug,
    topInsight?.id ?? ""
  );

  const blogStatus = statuses.blog;
  const blogPostId = postIds.blog;

  const isGenerating = blogStatus === "generating";
  const isComplete = blogStatus === "complete";
  const isError = blogStatus === "error";

  function handleGenerate() {
    if (!topInsight?.id || isGenerating) return;
    generateFormats(["blog"]);
  }

  return (
    <div className="w-full max-w-lg bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-8">
      <p className="text-sf-text-muted text-xs font-medium uppercase tracking-widest mb-6">
        Step 5 of 5
      </p>

      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-xl font-bold text-sf-text-primary">
          Generate your first post
        </h2>
        <OnboardingTooltip content="SessionForge turns your top insight into a shareable blog post in seconds. The AI agent writes a full draft you can edit before publishing." />
      </div>
      <p className="text-sf-text-secondary text-sm mb-6">
        We&apos;ll use your highest-scored insight to generate a blog post draft.
        You can review and edit it before publishing.
      </p>

      {/* Top insight card */}
      <div className="mb-6">
        {insights.isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="text-sf-accent animate-spin" />
          </div>
        )}

        {!insights.isLoading && !topInsight && (
          <div className="text-center py-8">
            <Lightbulb size={32} className="mx-auto text-sf-text-muted mb-3" />
            <p className="text-sm text-sf-text-secondary">
              No insights available yet. Skip this step and generate posts from
              the Insights tab later.
            </p>
          </div>
        )}

        {topInsight && (
          <div className="bg-sf-bg-tertiary border border-sf-border rounded-sf p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 rounded-sf-full text-xs font-medium text-sf-accent bg-sf-accent-bg">
                Top insight
              </span>
              <span className="ml-auto px-3 py-0.5 bg-sf-accent-bg text-sf-accent rounded-sf-full text-xs font-bold font-display">
                {topInsight.compositeScore?.toFixed(0) ?? 0}/65
              </span>
            </div>
            <h3 className="font-semibold text-sf-text-primary text-sm mb-1">
              {topInsight.title}
            </h3>
            <p className="text-xs text-sf-text-secondary line-clamp-2">
              {topInsight.description}
            </p>
          </div>
        )}
      </div>

      {/* Generation status */}
      {isGenerating && (
        <div className="flex items-center gap-3 mb-6 px-4 py-3 bg-sf-bg-tertiary border border-sf-border rounded-sf">
          <Loader2 size={16} className="text-sf-accent animate-spin flex-shrink-0" />
          <p className="text-sm text-sf-text-secondary">
            Generating your blog post draft…
          </p>
        </div>
      )}

      {isComplete && blogPostId && (
        <div className="flex items-center gap-3 mb-6 px-4 py-3 bg-green-500/10 border border-green-500/30 rounded-sf">
          <Sparkles size={16} className="text-green-400 flex-shrink-0" />
          <p className="text-sm text-green-300 flex-1">
            Blog post draft created!
          </p>
          <a
            href={`/${workspaceSlug}/content/${blogPostId}`}
            className="flex items-center gap-1 text-sm font-medium text-sf-accent hover:text-sf-accent-dim transition-colors flex-shrink-0"
          >
            View Draft
            <ExternalLink size={12} />
          </a>
        </div>
      )}

      {isComplete && !blogPostId && (
        <div className="flex items-center gap-3 mb-6 px-4 py-3 bg-green-500/10 border border-green-500/30 rounded-sf">
          <Sparkles size={16} className="text-green-400 flex-shrink-0" />
          <p className="text-sm text-green-300">
            Blog post generated! Check the Content tab to view your draft.
          </p>
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-3 mb-6 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-sf">
          <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-300">
            Generation failed. You can try again or skip this step.
          </p>
        </div>
      )}

      {/* Generate button */}
      {!isComplete && topInsight && (
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating || insights.isLoading}
          className={cn(
            "w-full flex items-center justify-center gap-2 font-medium py-2.5 rounded-sf transition-colors mb-6",
            isGenerating || insights.isLoading
              ? "bg-sf-accent/50 text-sf-bg-primary cursor-not-allowed"
              : "bg-sf-accent text-sf-bg-primary hover:bg-sf-accent-dim"
          )}
        >
          {isGenerating ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Generating…
            </>
          ) : isError ? (
            "Retry Generation"
          ) : (
            <>
              <Sparkles size={16} />
              Generate Blog Post
            </>
          )}
        </button>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={isGenerating}
          className="flex-1 bg-sf-bg-tertiary border border-sf-border text-sf-text-secondary font-medium py-2 rounded-sf hover:border-sf-border-focus hover:text-sf-text-primary transition-colors disabled:opacity-50"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onComplete}
          disabled={isGenerating}
          className="flex-1 bg-sf-accent text-sf-bg-primary font-medium py-2 rounded-sf hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
        >
          Finish Setup
        </button>
      </div>
    </div>
  );
}
