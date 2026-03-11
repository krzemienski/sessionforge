"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Sparkles, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { MetricsOverview } from "@/components/writing-coach/metrics-overview";
import { AuthenticityTrendChart } from "@/components/writing-coach/authenticity-trend-chart";
import { VoiceConsistencyCard } from "@/components/writing-coach/voice-consistency-card";
import { BenchmarkComparison } from "@/components/writing-coach/benchmark-comparison";
import { AIPatternPanel } from "@/components/writing-coach/ai-pattern-panel";

type Timeframe = "7d" | "30d" | "90d";

const TIMEFRAMES: { label: string; value: Timeframe }[] = [
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
  { label: "90 days", value: "90d" },
];

interface Aggregates {
  avgReadability: number;
  avgAuthenticityScore: number;
  avgVocabDiversity: number;
  avgPassiveVoicePct: number;
  totalAiPatternHits: number;
  postsAnalyzed: number;
  voiceConsistencyAvg: number;
}

interface AIPattern {
  phrase: string;
  category: "hedge" | "filler" | "corporate" | "ai-signature";
  count: number;
}

interface TrendDataPoint {
  date: string;
  avgAuthenticityScore: number;
  avgReadability: number;
  aiPatternHits: number;
}

interface RecentPost {
  id: string;
  title: string | null;
  authenticityScore: number;
  grade: "A" | "B" | "C" | "D" | "F";
  topIssue: string;
}

interface Benchmarks {
  readability: number;
  vocabDiversity: number;
  passiveVoicePct: number;
  authenticityScore: number;
}

interface AnalyticsData {
  aggregates: Aggregates;
  topAiPatterns: AIPattern[];
  trendData: TrendDataPoint[];
  recentPosts: RecentPost[];
  benchmarks: Benchmarks;
}

// AI pattern alternatives mapping
const AI_PATTERN_ALTERNATIVES: Record<string, string> = {
  "delve into": "explore",
  "cutting-edge": "modern",
  "revolutionize": "change",
  "game-changer": "breakthrough",
  "seamless": "smooth",
  "robust": "reliable",
  "leverage": "use",
  "paradigm": "model",
  "synergy": "cooperation",
  "utilize": "use",
  "in conclusion": "finally",
  "it is worth noting": "note that",
  "needless to say": "(remove)",
  "at the end of the day": "ultimately",
  "on the other hand": "however",
};

function getGradeColor(grade: string): string {
  switch (grade.toUpperCase()) {
    case "A":
      return "text-green-400";
    case "B":
      return "text-blue-400";
    case "C":
      return "text-yellow-400";
    case "D":
      return "text-orange-400";
    case "F":
      return "text-red-400";
    default:
      return "text-sf-text-secondary";
  }
}

function RecentPostsTable({ posts, workspace }: { posts: RecentPost[]; workspace: string }) {
  if (posts.length === 0) {
    return (
      <div className="text-center py-8 text-sf-text-secondary text-sm">
        No analyzed posts yet. Click "Analyze All Posts" to get started.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-sf-border">
            <th className="text-left py-3 px-4 text-xs font-semibold text-sf-text-secondary uppercase tracking-wide">
              Post Title
            </th>
            <th className="text-center py-3 px-4 text-xs font-semibold text-sf-text-secondary uppercase tracking-wide">
              Score
            </th>
            <th className="text-center py-3 px-4 text-xs font-semibold text-sf-text-secondary uppercase tracking-wide">
              Grade
            </th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-sf-text-secondary uppercase tracking-wide">
              Top Issue
            </th>
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => (
            <tr
              key={post.id}
              className="border-b border-sf-border last:border-0 hover:bg-sf-bg-tertiary transition-colors"
            >
              <td className="py-3 px-4">
                <a
                  href={`/${workspace}/writing-coach/post/${post.id}`}
                  className="text-sm text-sf-text-primary hover:text-sf-accent transition-colors font-medium"
                >
                  {post.title || "Untitled Post"}
                </a>
              </td>
              <td className="py-3 px-4 text-center">
                <span className="text-sm font-bold font-display text-sf-text-primary tabular-nums">
                  {post.authenticityScore.toFixed(0)}
                </span>
              </td>
              <td className="py-3 px-4 text-center">
                <span className={cn("text-sm font-bold font-display", getGradeColor(post.grade))}>
                  {post.grade}
                </span>
              </td>
              <td className="py-3 px-4">
                <span className="text-sm text-sf-text-secondary">{post.topIssue}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function WritingCoachPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const [timeframe, setTimeframe] = useState<Timeframe>("30d");

  const query = useQuery<AnalyticsData>({
    queryKey: ["writing-coach-analytics", workspace, timeframe],
    queryFn: async () => {
      const sp = new URLSearchParams({ workspace, timeframe });
      const res = await fetch(`/api/writing-coach/analytics?${sp}`);
      if (!res.ok) throw new Error("Failed to fetch writing coach analytics");
      return res.json();
    },
    enabled: !!workspace,
  });

  const data = query.data;

  // Calculate trends for metrics (comparing to benchmarks)
  const getTrend = (value: number, benchmark: number, invertGood = false): "up" | "down" | "neutral" => {
    const diff = value - benchmark;
    if (Math.abs(diff) < 3) return "neutral";
    if (invertGood) {
      return diff > 0 ? "down" : "up";
    }
    return diff > 0 ? "up" : "down";
  };

  // Calculate benchmark percentages (how close to benchmark on 0-100 scale)
  const getBenchmarkPercentage = (value: number, benchmark: number, invertGood = false): number => {
    if (invertGood) {
      // For metrics where lower is better (e.g., passive voice)
      // If value is 0, that's perfect (100%)
      // If value equals benchmark, that's 75%
      // If value is 2x benchmark, that's 0%
      const ratio = value / (benchmark * 2);
      return Math.max(0, Math.min(100, (1 - ratio) * 100));
    } else {
      // For metrics where higher is better
      // Use value directly as percentage, capped at 100
      return Math.min(100, Math.max(0, value));
    }
  };

  // Determine authenticity grade
  const getAuthenticityGrade = (score: number): string => {
    if (score >= 90) return "A";
    if (score >= 80) return "B";
    if (score >= 70) return "C";
    if (score >= 60) return "D";
    return "F";
  };

  // Determine voice consistency level
  const getConsistencyLevel = (score: number | null): "very-consistent" | "mostly-consistent" | "somewhat-inconsistent" | "inconsistent" | null => {
    if (score === null || score === 0) return null;
    if (score >= 85) return "very-consistent";
    if (score >= 70) return "mostly-consistent";
    if (score >= 50) return "somewhat-inconsistent";
    return "inconsistent";
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-display">Writing Coach</h1>
        <div className="flex items-center gap-2">
          <button
            className="px-4 py-2 rounded-sf text-sm font-medium text-white bg-sf-accent hover:bg-sf-accent-hover transition-colors border border-sf-accent flex items-center gap-2"
            onClick={() => {
              // TODO: Implement analyze all posts functionality
              alert("Analyze All Posts functionality coming soon!");
            }}
          >
            <Sparkles size={16} />
            Analyze All Posts
          </button>
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setTimeframe(tf.value)}
              className={cn(
                "px-3 py-1.5 rounded-sf text-sm font-medium transition-colors",
                timeframe === tf.value
                  ? "bg-sf-accent text-white"
                  : "bg-sf-bg-secondary border border-sf-border text-sf-text-secondary hover:border-sf-border-focus"
              )}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {query.isLoading && (
        <div className="flex items-center justify-center py-12 text-sf-text-secondary">
          <RefreshCw size={20} className="animate-spin mr-2" />
          Loading analytics…
        </div>
      )}

      {query.isError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-sf-lg p-4 text-red-400 text-sm">
          Failed to load writing coach analytics. Please try again later.
        </div>
      )}

      {data && (
        <>
          {/* Metrics Overview */}
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-sf-text-secondary uppercase tracking-wide mb-3">
              Overview ({timeframe})
            </h2>
            <MetricsOverview
              authenticityScore={{
                value: data.aggregates.avgAuthenticityScore,
                grade: getAuthenticityGrade(data.aggregates.avgAuthenticityScore),
                trend: getTrend(data.aggregates.avgAuthenticityScore, data.benchmarks.authenticityScore),
                benchmark: getBenchmarkPercentage(data.aggregates.avgAuthenticityScore, data.benchmarks.authenticityScore),
              }}
              vocabDiversity={{
                value: data.aggregates.avgVocabDiversity * 100,
                trend: getTrend(data.aggregates.avgVocabDiversity * 100, data.benchmarks.vocabDiversity * 100),
                benchmark: getBenchmarkPercentage(data.aggregates.avgVocabDiversity * 100, data.benchmarks.vocabDiversity * 100),
              }}
              passiveVoice={{
                value: data.aggregates.avgPassiveVoicePct,
                trend: getTrend(data.aggregates.avgPassiveVoicePct, data.benchmarks.passiveVoicePct, true),
                benchmark: getBenchmarkPercentage(data.aggregates.avgPassiveVoicePct, data.benchmarks.passiveVoicePct, true),
              }}
              aiPatternHits={{
                value: data.aggregates.totalAiPatternHits,
                total: data.aggregates.totalAiPatternHits,
                trend: data.aggregates.totalAiPatternHits > 10 ? "down" : data.aggregates.totalAiPatternHits > 5 ? "neutral" : "up",
                benchmark: data.aggregates.totalAiPatternHits > 10 ? 30 : data.aggregates.totalAiPatternHits > 5 ? 60 : 90,
              }}
            />
          </div>

          {/* Two-column: Authenticity Trend Chart + Voice Consistency Card */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <AuthenticityTrendChart trendData={data.trendData} />
            <VoiceConsistencyCard
              data={{
                score: data.aggregates.voiceConsistencyAvg,
                consistencyLevel: getConsistencyLevel(data.aggregates.voiceConsistencyAvg),
                deviations: [], // TODO: Add deviations when available from API
                hasStyleProfile: data.aggregates.postsAnalyzed > 0,
              }}
              workspace={workspace}
            />
          </div>

          {/* Two-column: Benchmark Comparison + AI Pattern Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <BenchmarkComparison
              readability={data.aggregates.avgReadability}
              vocabDiversity={data.aggregates.avgVocabDiversity * 100}
              passiveVoice={data.aggregates.avgPassiveVoicePct}
              authenticity={data.aggregates.avgAuthenticityScore}
            />
            <AIPatternPanel
              patterns={data.topAiPatterns.map((pattern) => ({
                phrase: pattern.phrase,
                category: pattern.category,
                hitCount: pattern.count,
                suggestedAlternative: AI_PATTERN_ALTERNATIVES[pattern.phrase.toLowerCase()] || "be more specific",
              }))}
            />
          </div>

          {/* Recent Posts Table */}
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-sf-text-secondary uppercase tracking-wide mb-3">
              Recent Analyzed Posts
            </h2>
            <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg overflow-hidden">
              <RecentPostsTable posts={data.recentPosts} workspace={workspace} />
            </div>
          </div>

          {data.aggregates.postsAnalyzed === 0 && (
            <div className="text-center py-12">
              <Sparkles size={40} className="mx-auto text-sf-text-muted mb-3" />
              <p className="text-sf-text-secondary mb-1">No posts analyzed yet.</p>
              <p className="text-sm text-sf-text-muted">
                Click "Analyze All Posts" to start analyzing your writing quality.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
