"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useInsight } from "@/hooks/use-insights";
import { useGenerateFormats, type FormatKey, type FormatStatus } from "@/hooks/use-generate";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { TemplateSelector } from "@/components/templates/template-selector";
import type { ContentTemplate } from "@/types/templates";

const DIMS = [
  { key: "noveltyScore", label: "Novel Problem-Solving", weight: "3x" },
  { key: "toolPatternScore", label: "Tool/Pattern Discovery", weight: "3x" },
  { key: "transformationScore", label: "Before/After Transform", weight: "2x" },
  { key: "failureRecoveryScore", label: "Failure + Recovery", weight: "3x" },
  { key: "reproducibilityScore", label: "Reproducibility", weight: "1x" },
  { key: "scaleScore", label: "Scale/Performance", weight: "1x" },
];

const FORMAT_OPTIONS: { key: FormatKey; label: string }[] = [
  { key: "blog", label: "Blog Post" },
  { key: "twitter", label: "Twitter Thread" },
  { key: "linkedin", label: "LinkedIn Post" },
  { key: "newsletter", label: "Newsletter" },
  { key: "changelog", label: "Changelog" },
];

const STATUS_BADGE: Record<FormatStatus, string> = {
  idle: "text-sf-text-muted bg-sf-bg-tertiary",
  generating: "text-sf-accent bg-sf-accent-bg",
  complete: "text-sf-success bg-sf-success/10",
  error: "text-red-400 bg-red-400/10",
};

const STATUS_LABEL: Record<FormatStatus, string> = {
  idle: "Not generated",
  generating: "Generating…",
  complete: "Done",
  error: "Error",
};

export default function InsightDetailPage() {
  const { workspace, insightId } = useParams<{ workspace: string; insightId: string }>();
  const router = useRouter();
  const insight = useInsight(insightId);
  const ins = insight.data;
  const [selectedTemplate, setSelectedTemplate] = useState<ContentTemplate | null>(null);

  const [selectedFormats, setSelectedFormats] = useState<Set<FormatKey>>(
    new Set<FormatKey>(["blog", "twitter", "linkedin", "newsletter", "changelog"])
  );

  const { statuses, postIds, generateFormats } = useGenerateFormats(workspace, insightId);

  const isAnyGenerating = Object.values(statuses).some((s) => s === "generating");
  const hasSelection = selectedFormats.size > 0;

  function toggleFormat(key: FormatKey) {
    setSelectedFormats((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function handleGenerate() {
    if (!hasSelection || isAnyGenerating) return;
    generateFormats(Array.from(selectedFormats));
  }

  if (insight.isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-sf-bg-tertiary rounded w-1/3" />
        <div className="h-4 bg-sf-bg-tertiary rounded w-2/3" />
        <div className="h-32 bg-sf-bg-tertiary rounded" />
      </div>
    );
  }

  if (!ins) return <p className="text-sf-text-muted">Insight not found.</p>;

  return (
    <div>
      <button onClick={() => router.push(`/${workspace}/insights`)} className="flex items-center justify-center gap-1 text-sf-text-secondary hover:text-sf-text-primary text-sm mb-4 min-h-[44px] min-w-[44px]">
        <ArrowLeft size={16} /> Insights
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold font-display mb-2">{ins.title}</h1>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <span className="px-3 py-1 bg-sf-accent-bg text-sf-accent rounded-sf-full text-lg font-bold font-display inline-block w-fit">
            {ins.compositeScore?.toFixed(0) ?? 0}/65
          </span>
          <span className="text-sm text-sf-text-secondary capitalize">
            {ins.category?.replace(/_/g, " ")}
          </span>
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
                  <span className="text-sf-text-secondary">
                    {dim.label}{" "}
                    <span className="text-sf-text-muted">({dim.weight})</span>
                  </span>
                  <span className="text-sf-text-primary font-display">{score}/5</span>
                </div>
                <div className="h-2 bg-sf-bg-tertiary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sf-accent rounded-full transition-all"
                    style={{ width: `${(score / 5) * 100}%` }}
                  />
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
            <div
              key={i}
              className="bg-sf-bg-tertiary border border-sf-border rounded-sf-lg overflow-hidden"
            >
              {snip.context && (
                <p className="text-xs text-sf-text-muted px-4 py-2 border-b border-sf-border">
                  {snip.context}
                </p>
              )}
              <pre className="p-4 overflow-x-auto text-sm font-code text-sf-accent">
                <code>{snip.code}</code>
              </pre>
            </div>
          ))}
        </div>
      )}

      <div className="mb-6">
        <h2 className="text-lg font-semibold font-display mb-4">Select a Template</h2>
        <TemplateSelector
          workspace={workspace}
          contentType="blog_post"
          selectedTemplateId={selectedTemplate?.id}
          onSelect={setSelectedTemplate}
        />
      </div>

      {/* Generate All Formats section */}
      <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4">
        <h2 className="text-lg font-semibold font-display mb-1">Generate Content</h2>
        <p className="text-sm text-sf-text-secondary mb-4">
          Select formats to generate simultaneously from this insight.
        </p>

        <div className="space-y-3 mb-4">
          {FORMAT_OPTIONS.map(({ key, label }) => {
            const status = statuses[key];
            const postId = postIds[key];
            const isChecked = selectedFormats.has(key);

            return (
              <div key={key} className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleFormat(key)}
                    disabled={isAnyGenerating}
                    className="w-4 h-4 accent-sf-accent rounded cursor-pointer disabled:cursor-not-allowed"
                  />
                  <span className="text-sm text-sf-text-primary">{label}</span>
                </label>

                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-sf-full text-xs font-medium",
                      STATUS_BADGE[status]
                    )}
                  >
                    {STATUS_LABEL[status]}
                  </span>
                  {status === "complete" && postId && (
                    <button
                      onClick={() => router.push(`/${workspace}/content/${postId}`)}
                      className="flex items-center gap-1 text-xs text-sf-accent hover:underline"
                    >
                      View <ExternalLink size={11} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={handleGenerate}
          disabled={!hasSelection || isAnyGenerating}
          className={cn(
            "w-full py-2.5 rounded-sf font-medium text-sm transition-colors min-h-[44px]",
            hasSelection && !isAnyGenerating
              ? "bg-sf-accent text-sf-bg-primary hover:bg-sf-accent-dim"
              : "bg-sf-bg-tertiary text-sf-text-muted cursor-not-allowed"
          )}
        >
          {isAnyGenerating ? "Generating…" : "Generate Selected"}
        </button>
      </div>
    </div>
  );
}
