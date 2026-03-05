"use client";

import { useEffect, useState } from "react";
import { BookOpen, AlertCircle, CheckCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type ReadingLevel =
  | "very-easy"
  | "easy"
  | "fairly-easy"
  | "standard"
  | "fairly-difficult"
  | "difficult"
  | "very-difficult";

interface ReadabilitySuggestion {
  type: "sentence-length" | "passive-voice" | "complex-words" | "paragraph-length";
  message: string;
  severity: "low" | "medium" | "high";
}

interface ReadabilityAnalysis {
  score: number;
  gradeLevel: number;
  readingLevel: ReadingLevel;
  wordCount: number;
  sentenceCount: number;
  averageSentenceLength: number;
  averageSyllablesPerWord: number;
  suggestions: ReadabilitySuggestion[];
}

interface SeoData {
  readabilityScore: number | null;
  seoAnalysis: { readability?: ReadabilityAnalysis } | null;
}

interface ReadabilityScoreProps {
  postId: string;
}

const READING_LEVEL_LABELS: Record<ReadingLevel, string> = {
  "very-easy": "Very Easy",
  "easy": "Easy",
  "fairly-easy": "Fairly Easy",
  "standard": "Standard",
  "fairly-difficult": "Fairly Difficult",
  "difficult": "Difficult",
  "very-difficult": "Very Difficult",
};

const READING_LEVEL_DESCRIPTIONS: Record<ReadingLevel, string> = {
  "very-easy": "Easily understood by an average 11-year-old student.",
  "easy": "Conversational English for consumers.",
  "fairly-easy": "Easily understood by 13 to 15-year-old students.",
  "standard": "Plain English — understood by 13 to 15-year-old students.",
  "fairly-difficult": "Fairly difficult to read.",
  "difficult": "Best understood by college graduates.",
  "very-difficult": "Very confusing text — best understood by university graduates.",
};

function scoreColor(score: number): "green" | "yellow" | "red" {
  if (score >= 70) return "green";
  if (score >= 50) return "yellow";
  return "red";
}

function SkeletonLine({ className }: { className?: string }) {
  return (
    <div
      className={cn("h-3 rounded bg-sf-bg-tertiary animate-pulse", className)}
    />
  );
}

function ScoreMeter({ score }: { score: number }) {
  const color = scoreColor(score);
  const clampedScore = Math.min(Math.max(score, 0), 100);

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between">
        <span
          className={cn(
            "text-3xl font-bold tabular-nums leading-none",
            color === "green" && "text-green-500",
            color === "yellow" && "text-yellow-500",
            color === "red" && "text-red-500"
          )}
        >
          {Math.round(clampedScore)}
        </span>
        <span className="text-xs text-sf-text-muted pb-1">/ 100</span>
      </div>

      {/* Track */}
      <div className="relative w-full h-3 rounded-full bg-sf-bg-tertiary overflow-hidden">
        {/* Gradient zones */}
        <div
          className="absolute inset-y-0 left-0 right-0 opacity-20"
          style={{
            background:
              "linear-gradient(to right, #ef4444 0%, #ef4444 50%, #eab308 50%, #eab308 70%, #22c55e 70%, #22c55e 100%)",
          }}
        />
        {/* Fill */}
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-all duration-500",
            color === "green" && "bg-green-500",
            color === "yellow" && "bg-yellow-500",
            color === "red" && "bg-red-500"
          )}
          style={{ width: `${clampedScore}%` }}
        />
        {/* Threshold markers */}
        <div
          className="absolute inset-y-0 w-px bg-sf-bg-secondary"
          style={{ left: "50%" }}
        />
        <div
          className="absolute inset-y-0 w-px bg-sf-bg-secondary"
          style={{ left: "70%" }}
        />
      </div>

      {/* Scale labels */}
      <div className="flex justify-between text-[10px] text-sf-text-muted">
        <span>0 Hard</span>
        <span>50</span>
        <span>70</span>
        <span>100 Easy</span>
      </div>
    </div>
  );
}

function GradeLevelBadge({ gradeLevel, readingLevel }: { gradeLevel: number; readingLevel: ReadingLevel }) {
  return (
    <div className="flex items-start gap-2 p-3 rounded bg-sf-bg-tertiary border border-sf-border">
      <Info size={13} className="text-sf-text-muted flex-shrink-0 mt-0.5" />
      <div className="min-w-0 space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-sf-text-secondary">
            Grade {Math.round(gradeLevel)} level
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sf-bg-secondary border border-sf-border text-sf-text-muted">
            {READING_LEVEL_LABELS[readingLevel]}
          </span>
        </div>
        <p className="text-xs text-sf-text-muted leading-relaxed">
          {READING_LEVEL_DESCRIPTIONS[readingLevel]}
        </p>
      </div>
    </div>
  );
}

function StatsGrid({
  wordCount,
  sentenceCount,
  avgSentenceLength,
  avgSyllablesPerWord,
}: {
  wordCount: number;
  sentenceCount: number;
  avgSentenceLength: number;
  avgSyllablesPerWord: number;
}) {
  const stats = [
    { label: "Words", value: wordCount.toLocaleString() },
    { label: "Sentences", value: sentenceCount.toLocaleString() },
    { label: "Avg. sentence", value: `${avgSentenceLength} words` },
    { label: "Avg. syllables", value: `${avgSyllablesPerWord} / word` },
  ];

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {stats.map(({ label, value }) => (
        <div
          key={label}
          className="flex flex-col p-2 rounded bg-sf-bg-tertiary border border-sf-border"
        >
          <span className="text-[10px] text-sf-text-muted uppercase tracking-wider">
            {label}
          </span>
          <span className="text-xs font-medium text-sf-text-secondary mt-0.5 tabular-nums">
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}

function SuggestionItem({ suggestion }: { suggestion: ReadabilitySuggestion }) {
  const Icon = suggestion.severity === "high" ? AlertCircle : Info;

  return (
    <div
      className={cn(
        "flex items-start gap-2 p-2.5 rounded border text-xs",
        suggestion.severity === "high" &&
          "bg-red-500/5 border-red-500/20 text-red-400",
        suggestion.severity === "medium" &&
          "bg-yellow-500/5 border-yellow-500/20 text-yellow-500",
        suggestion.severity === "low" &&
          "bg-sf-bg-tertiary border-sf-border text-sf-text-muted"
      )}
    >
      <Icon size={12} className="flex-shrink-0 mt-0.5" />
      <p className="leading-relaxed">{suggestion.message}</p>
    </div>
  );
}

export function ReadabilityScore({ postId }: ReadabilityScoreProps) {
  const [data, setData] = useState<SeoData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/content/${postId}/seo`)
      .then((res) => {
        if (!res.ok) return null;
        return res.json() as Promise<SeoData>;
      })
      .then((json) => {
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [postId]);

  if (loading) {
    return (
      <div className="border border-sf-border rounded-sf bg-sf-bg-secondary p-4 space-y-3">
        <SkeletonLine className="w-36" />
        <SkeletonLine className="w-full h-3" />
        <SkeletonLine className="w-full h-12" />
        <div className="grid grid-cols-2 gap-1.5">
          <SkeletonLine className="h-10" />
          <SkeletonLine className="h-10" />
          <SkeletonLine className="h-10" />
          <SkeletonLine className="h-10" />
        </div>
      </div>
    );
  }

  const score = data?.readabilityScore ?? null;
  const analysis = data?.seoAnalysis?.readability ?? null;

  return (
    <div className="border border-sf-border rounded-sf bg-sf-bg-secondary p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <BookOpen size={13} className="text-sf-text-muted flex-shrink-0" />
        <h3 className="text-xs font-semibold text-sf-text-muted uppercase tracking-wider">
          Readability Score
        </h3>
      </div>

      {score === null ? (
        <p className="text-sm text-sf-text-muted">
          Run SEO analysis to calculate the Flesch-Kincaid readability score.
        </p>
      ) : (
        <>
          {/* Score meter */}
          <ScoreMeter score={score} />

          {/* Grade level */}
          {analysis && (
            <GradeLevelBadge
              gradeLevel={analysis.gradeLevel}
              readingLevel={analysis.readingLevel}
            />
          )}

          {/* Stats grid */}
          {analysis && (
            <StatsGrid
              wordCount={analysis.wordCount}
              sentenceCount={analysis.sentenceCount}
              avgSentenceLength={analysis.averageSentenceLength}
              avgSyllablesPerWord={analysis.averageSyllablesPerWord}
            />
          )}

          {/* Improvement suggestions */}
          {analysis && analysis.suggestions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-sf-text-muted uppercase tracking-wider">
                Improvement Tips
              </h4>
              <div className="space-y-1.5">
                {analysis.suggestions.map((suggestion, index) => (
                  <SuggestionItem key={index} suggestion={suggestion} />
                ))}
              </div>
            </div>
          )}

          {/* All good state */}
          {analysis && analysis.suggestions.length === 0 && (
            <div className="flex items-center gap-2 p-2.5 rounded bg-green-500/5 border border-green-500/20 text-xs text-green-400">
              <CheckCircle size={12} className="flex-shrink-0" />
              <p>Great readability! No major issues found.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
