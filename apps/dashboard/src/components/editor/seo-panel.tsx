"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, XCircle, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSeoData, useGenerateSeo, useSaveSeo } from "@/hooks/use-content";
import { computeSeoScore, computeReadabilityScore } from "@/lib/seo";
import type { SeoMetadata } from "@/lib/seo";

interface SeoPanelProps {
  postId: string;
  markdown: string;
  title: string;
  refreshKey?: number;
}

function scoreColor(score: number): string {
  if (score >= 70) return "text-sf-success";
  if (score >= 40) return "text-amber-500";
  return "text-red-500";
}

function scoreBarColor(score: number): string {
  if (score >= 70) return "bg-sf-success";
  if (score >= 40) return "bg-amber-500";
  return "bg-red-500";
}

function metaTitleCounterColor(len: number): string {
  if (len >= 50 && len <= 60) return "text-sf-success";
  if (len >= 40) return "text-amber-500";
  return "text-red-500";
}

function metaDescCounterColor(len: number): string {
  if (len >= 145 && len <= 155) return "text-sf-success";
  if (len >= 120) return "text-amber-500";
  return "text-red-500";
}

export function SeoPanel({ postId, markdown, title, refreshKey }: SeoPanelProps) {
  const seoData = useSeoData(postId);
  const generate = useGenerateSeo();
  const save = useSaveSeo();

  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");

  // Sync local state when SEO metadata loads or is regenerated
  useEffect(() => {
    if (seoData.data?.seoMetadata) {
      setMetaTitle(seoData.data.seoMetadata.metaTitle ?? "");
      setMetaDescription(seoData.data.seoMetadata.metaDescription ?? "");
    }
  }, [seoData.data]);

  // Re-fetch SEO data when refreshKey changes (triggered by auto-analyze on save)
  useEffect(() => {
    if (refreshKey && refreshKey > 0) {
      seoData.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  function handleGenerate() {
    generate.mutate({ postId });
  }

  function handleTitleBlur() {
    save.mutate({ postId, metaTitle });
  }

  function handleDescriptionBlur() {
    save.mutate({ postId, metaDescription });
  }

  // Compute live scores from current editor content
  const seoMetadata: SeoMetadata | null = seoData.data?.seoMetadata ?? null;
  const liveScore = computeSeoScore(markdown, title, seoMetadata ?? undefined);
  const liveReadability = computeReadabilityScore(markdown);

  const score = liveScore.total;
  const checks = liveScore.checks;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-sf-border flex items-center justify-between">
        <h3 className="font-display font-semibold text-sf-text-primary text-sm">SEO</h3>
        <button
          onClick={handleGenerate}
          disabled={generate.isPending}
          className="flex items-center gap-1.5 bg-sf-accent text-sf-bg-primary px-3 py-1.5 rounded-sf font-medium text-xs hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
        >
          {generate.isPending ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Sparkles size={13} />
          )}
          Generate SEO
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 min-h-0">
        {seoData.isLoading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 size={20} className="text-sf-accent animate-spin" />
          </div>
        )}

        {!seoData.isLoading && (
          <>
            {/* Overall SEO Score */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-sf-text-secondary">SEO Score</span>
                <span className={cn("text-sm font-bold font-display", scoreColor(score))}>
                  {score}/100
                </span>
              </div>
              <div className="h-2 bg-sf-bg-tertiary rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", scoreBarColor(score))}
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>

            {/* Checklist */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-sf-text-secondary mb-2">Checklist</p>
              {checks.map((check) => (
                <div key={check.id} className="flex items-start gap-2">
                  {check.pass ? (
                    <CheckCircle2 size={14} className="text-sf-success flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle size={14} className="text-sf-text-muted flex-shrink-0 mt-0.5" />
                  )}
                  <span
                    className={cn(
                      "text-xs",
                      check.pass ? "text-sf-text-primary" : "text-sf-text-muted"
                    )}
                  >
                    {check.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Meta Title */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-sf-text-secondary">Meta Title</label>
                <span className={cn("text-xs", metaTitleCounterColor(metaTitle.length))}>
                  {metaTitle.length}/60
                </span>
              </div>
              <input
                type="text"
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                onBlur={handleTitleBlur}
                maxLength={80}
                placeholder="Meta title..."
                className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary placeholder:text-sf-text-muted focus:outline-none focus:border-sf-border-focus"
              />
            </div>

            {/* Meta Description */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-sf-text-secondary">Meta Description</label>
                <span className={cn("text-xs", metaDescCounterColor(metaDescription.length))}>
                  {metaDescription.length}/155
                </span>
              </div>
              <textarea
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                onBlur={handleDescriptionBlur}
                rows={3}
                maxLength={200}
                placeholder="Meta description..."
                className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary placeholder:text-sf-text-muted resize-none focus:outline-none focus:border-sf-border-focus"
              />
            </div>

            {/* Social Preview */}
            {(seoMetadata?.ogTitle || seoMetadata?.ogDescription) && (
              <div>
                <p className="text-xs font-medium text-sf-text-secondary mb-2">Social Preview</p>
                <div className="bg-sf-bg-tertiary border border-sf-border rounded-sf p-3 space-y-1">
                  {seoMetadata.ogTitle && (
                    <p className="text-sm font-semibold text-sf-text-primary line-clamp-1">
                      {seoMetadata.ogTitle}
                    </p>
                  )}
                  {seoMetadata.ogDescription && (
                    <p className="text-xs text-sf-text-secondary line-clamp-2">
                      {seoMetadata.ogDescription}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Readability */}
            <div>
              <p className="text-xs font-medium text-sf-text-secondary mb-2">Readability</p>
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className={cn(
                    "inline-flex items-center rounded-sf px-2 py-0.5 text-xs font-bold",
                    liveReadability.score >= 70
                      ? "bg-sf-success/20 text-sf-success"
                      : liveReadability.score >= 50
                      ? "bg-amber-500/20 text-amber-500"
                      : "bg-red-500/20 text-red-500"
                  )}
                >
                  {liveReadability.score}
                </span>
                <span className="text-xs text-sf-text-secondary">{liveReadability.grade}</span>
              </div>
              {liveReadability.suggestions.length > 0 && (
                <p className="text-xs text-sf-text-muted">{liveReadability.suggestions[0]}</p>
              )}
            </div>

            {/* Empty state — no SEO metadata generated yet */}
            {!seoMetadata && (
              <div className="text-center py-4 border border-dashed border-sf-border rounded-sf">
                <p className="text-xs text-sf-text-muted">No SEO metadata yet.</p>
                <p className="text-xs text-sf-text-muted mt-0.5">
                  Click &ldquo;Generate SEO&rdquo; above to create meta tags.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
