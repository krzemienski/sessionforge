"use client";

import { useParams } from "next/navigation";
import { useRecommendations, useGenerateRecommendations } from "@/hooks/use-recommendations";
import { useState } from "react";
import { Sparkles, RefreshCw, BookOpen, AlignLeft, Tag, TrendingUp, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

const TYPES: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  topic: { label: "Topic", color: "text-purple-400 bg-purple-400/10", icon: <BookOpen size={12} /> },
  format: { label: "Format", color: "text-blue-400 bg-blue-400/10", icon: <Layers size={12} /> },
  length: { label: "Length", color: "text-green-400 bg-green-400/10", icon: <AlignLeft size={12} /> },
  keyword: { label: "Keyword", color: "text-yellow-400 bg-yellow-400/10", icon: <Tag size={12} /> },
  improvement: { label: "Improvement", color: "text-red-400 bg-red-400/10", icon: <TrendingUp size={12} /> },
};

export default function RecommendationsPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const [isGenerating, setIsGenerating] = useState(false);
  const recommendations = useRecommendations(workspace, { limit: 50 });
  const generateRecommendations = useGenerateRecommendations(workspace);
  const recList = recommendations.data?.recommendations ?? [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const grouped = (recList as any[]).reduce((acc: Record<string, any[]>, rec: any) => {
    const type = rec.recommendationType ?? "topic";
    if (!acc[type]) acc[type] = [];
    acc[type].push(rec);
    return acc;
  }, {});

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      await generateRecommendations.mutateAsync(undefined);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-display">Recommendations</h1>
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="flex items-center gap-2 px-4 py-2 bg-sf-accent text-white rounded-sf-lg text-sm font-medium hover:bg-sf-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw size={14} className={cn(isGenerating && "animate-spin")} />
          {isGenerating ? "Generating…" : "Generate New"}
        </button>
      </div>

      {recommendations.isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4 animate-pulse h-24" />
          ))}
        </div>
      ) : recList.length === 0 ? (
        <div className="text-center py-12">
          <Sparkles size={40} className="mx-auto text-sf-text-muted mb-3" />
          <p className="text-sf-text-secondary">No recommendations yet. Generate your first batch to get started.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([type, recs]) => {
            const meta = TYPES[type] ?? { label: type, color: "text-sf-text-secondary bg-sf-bg-tertiary", icon: <Sparkles size={12} /> };
            return (
              <div key={type}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={cn("flex items-center gap-1 px-2 py-0.5 rounded-sf-full text-xs font-medium", meta.color)}>
                    {meta.icon}
                    {meta.label}
                  </span>
                  <span className="text-xs text-sf-text-muted">{recs.length} recommendation{recs.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="space-y-3">
                  {recs.map((rec: any) => (
                    <div
                      key={rec.id}
                      className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4 transition-colors hover:border-sf-border-focus"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h3 className="font-semibold text-sf-text-primary">{rec.title}</h3>
                        <span className="shrink-0 px-2 py-0.5 bg-sf-accent-bg text-sf-accent rounded-sf-full text-xs font-bold font-display">
                          {(rec.confidenceScore * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-sm text-sf-text-secondary mb-3">{rec.description}</p>
                      {rec.reasoning && (
                        <div className="border-t border-sf-border pt-3">
                          <p className="text-xs text-sf-text-muted leading-relaxed">{rec.reasoning}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
