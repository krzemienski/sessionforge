"use client";

import { useParams } from "next/navigation";
import {
  useRecommendations,
  useGenerateRecommendations,
  useRateRecommendation,
} from "@/hooks/use-recommendations";
import { useState, useCallback } from "react";
import { Sparkles, RefreshCw, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { RecommendationCard } from "@/components/recommendations-card";
import type { Recommendation } from "@/components/recommendations-card";

export default function RecommendationsPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const [isGenerating, setIsGenerating] = useState(false);

  const recommendations = useRecommendations(workspace, { limit: 50 });
  const generateRecommendations = useGenerateRecommendations(workspace);
  const rateRecommendation = useRateRecommendation(workspace);

  const recList: Recommendation[] = recommendations.data?.recommendations ?? [];

  // Top 3 by confidence score for weekly digest
  const topThree = [...recList]
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
    .slice(0, 3);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      await generateRecommendations.mutateAsync(undefined);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRate = useCallback(
    async (id: string, helpful: boolean) => {
      await rateRecommendation.mutateAsync({ id, helpful });
    },
    [rateRecommendation]
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-display">Recommendations</h1>
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="flex items-center gap-2 px-4 py-2 bg-sf-accent text-white rounded-sf-lg text-sm font-medium hover:bg-sf-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw
            size={14}
            className={cn(isGenerating && "animate-spin")}
          />
          {isGenerating ? "Generating…" : "Generate New"}
        </button>
      </div>

      {recommendations.isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4 animate-pulse h-24"
            />
          ))}
        </div>
      ) : recList.length === 0 ? (
        <div className="text-center py-12">
          <Sparkles size={40} className="mx-auto text-sf-text-muted mb-3" />
          <p className="text-sf-text-secondary">
            No recommendations yet. Generate your first batch to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Weekly Digest — top 3 by confidence */}
          {topThree.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Trophy size={16} className="text-sf-accent" />
                <h2 className="text-sm font-semibold text-sf-text-primary font-display">
                  Weekly Digest
                </h2>
                <span className="text-xs text-sf-text-muted">
                  Top {topThree.length} recommendation
                  {topThree.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="space-y-3">
                {topThree.map((rec) => (
                  <RecommendationCard
                    key={rec.id}
                    recommendation={rec}
                    onRate={handleRate}
                  />
                ))}
              </div>
            </section>
          )}

          {/* All recommendations */}
          <section>
            <h2 className="text-sm font-semibold text-sf-text-primary font-display mb-3">
              All Recommendations
            </h2>
            <div className="space-y-3">
              {recList.map((rec) => (
                <RecommendationCard
                  key={rec.id}
                  recommendation={rec}
                  onRate={handleRate}
                />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
