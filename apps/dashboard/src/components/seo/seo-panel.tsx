"use client";

import { useEffect, useState } from "react";
import { BarChart2, Tag, BookOpen, Eye, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

type SeoTab = "overview" | "keywords" | "readability" | "preview" | "geo";

interface SeoData {
  id: string;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImage: string | null;
  keywords: string[] | null;
  structuredData: unknown;
  readabilityScore: number | null;
  geoScore: number | null;
  geoChecklist: unknown;
  seoAnalysis: unknown;
}

interface SeoPanelProps {
  postId: string;
  refreshKey?: number;
}

function SkeletonLine({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "h-3 rounded bg-sf-bg-tertiary animate-pulse",
        className
      )}
    />
  );
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <span className="text-xs text-sf-text-muted">—</span>
    );
  }

  const color =
    score >= 80
      ? "text-green-500"
      : score >= 50
      ? "text-yellow-500"
      : "text-red-500";

  return (
    <span className={cn("text-sm font-semibold", color)}>
      {Math.round(score)}
    </span>
  );
}

function CompositeScore({ readability, geo }: { readability: number | null; geo: number | null }) {
  const hasData = readability !== null || geo !== null;
  if (!hasData) {
    return (
      <p className="text-sm text-sf-text-muted">
        Run analysis to see your SEO score.
      </p>
    );
  }

  const scores = [readability, geo].filter((s): s is number => s !== null);
  const composite = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  const color =
    composite >= 80
      ? "text-green-500"
      : composite >= 50
      ? "text-yellow-500"
      : "text-red-500";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-sf-text-secondary">Composite Score</span>
        <span className={cn("text-2xl font-bold", color)}>{composite}</span>
      </div>
      <div className="w-full h-2 rounded-full bg-sf-bg-tertiary overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            composite >= 80
              ? "bg-green-500"
              : composite >= 50
              ? "bg-yellow-500"
              : "bg-red-500"
          )}
          style={{ width: `${composite}%` }}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 pt-1">
        <div className="flex flex-col items-center p-2 rounded bg-sf-bg-tertiary">
          <span className="text-xs text-sf-text-muted mb-0.5">Readability</span>
          <ScoreBadge score={readability} />
        </div>
        <div className="flex flex-col items-center p-2 rounded bg-sf-bg-tertiary">
          <span className="text-xs text-sf-text-muted mb-0.5">GEO</span>
          <ScoreBadge score={geo !== null ? geo * 100 : null} />
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ data }: { data: SeoData }) {
  return (
    <div className="space-y-4">
      <CompositeScore
        readability={data.readabilityScore}
        geo={data.geoScore}
      />

      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-sf-text-muted uppercase tracking-wider">
          Meta Title
        </h4>
        {data.metaTitle ? (
          <p className="text-sm text-sf-text-secondary line-clamp-2">
            {data.metaTitle}
          </p>
        ) : (
          <p className="text-sm text-sf-text-muted italic">Not set</p>
        )}
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-sf-text-muted uppercase tracking-wider">
          Meta Description
        </h4>
        {data.metaDescription ? (
          <p className="text-sm text-sf-text-secondary line-clamp-3">
            {data.metaDescription}
          </p>
        ) : (
          <p className="text-sm text-sf-text-muted italic">Not set</p>
        )}
      </div>
    </div>
  );
}

function KeywordsTab({ data }: { data: SeoData }) {
  const keywords = data.keywords ?? [];

  if (keywords.length === 0) {
    return (
      <p className="text-sm text-sf-text-muted">
        No keywords extracted yet. Run analysis to generate keyword suggestions.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold text-sf-text-muted uppercase tracking-wider">
        Extracted Keywords
      </h4>
      <div className="flex flex-wrap gap-1.5">
        {keywords.map((kw) => (
          <span
            key={kw}
            className="font-code text-xs px-2 py-1 rounded bg-sf-bg-tertiary border border-sf-border text-sf-text-secondary"
          >
            {kw}
          </span>
        ))}
      </div>
    </div>
  );
}

function ReadabilityTab({ data }: { data: SeoData }) {
  const score = data.readabilityScore;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-sf-text-muted uppercase tracking-wider">
          Flesch-Kincaid Score
        </h4>
        <ScoreBadge score={score} />
      </div>

      {score !== null && (
        <div className="w-full h-2 rounded-full bg-sf-bg-tertiary overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              score >= 70
                ? "bg-green-500"
                : score >= 50
                ? "bg-yellow-500"
                : "bg-red-500"
            )}
            style={{ width: `${Math.min(score, 100)}%` }}
          />
        </div>
      )}

      {score === null && (
        <p className="text-sm text-sf-text-muted">
          Run analysis to see readability score.
        </p>
      )}

      {score !== null && (
        <p className="text-xs text-sf-text-muted">
          {score >= 70
            ? "Easy to read — good for a broad audience."
            : score >= 50
            ? "Fairly readable — suitable for most adults."
            : "Difficult to read — consider simplifying sentences."}
        </p>
      )}
    </div>
  );
}

function PreviewTab({ data }: { data: SeoData }) {
  const title = data.metaTitle ?? "No title set";
  const description = data.metaDescription ?? "No description set.";

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h4 className="text-xs font-semibold text-sf-text-muted uppercase tracking-wider mb-2">
          Google Preview
        </h4>
        <div className="border border-sf-border rounded-sf p-3 bg-sf-bg-primary space-y-0.5">
          <p className="text-xs text-sf-text-muted truncate">
            https://yourdomain.com/blog/...
          </p>
          <p className="text-sm font-medium text-blue-500 truncate">{title}</p>
          <p className="text-xs text-sf-text-secondary line-clamp-2">
            {description}
          </p>
        </div>
      </div>

      <div className="space-y-1">
        <h4 className="text-xs font-semibold text-sf-text-muted uppercase tracking-wider mb-2">
          Social Card
        </h4>
        <div className="border border-sf-border rounded-sf overflow-hidden bg-sf-bg-primary">
          {data.ogImage ? (
            <img
              src={data.ogImage}
              alt="OG preview"
              className="w-full h-24 object-cover"
            />
          ) : (
            <div className="w-full h-24 bg-sf-bg-tertiary flex items-center justify-center">
              <span className="text-xs text-sf-text-muted">No OG image</span>
            </div>
          )}
          <div className="p-2 space-y-0.5">
            <p className="text-xs text-sf-text-muted">yourdomain.com</p>
            <p className="text-sm font-medium text-sf-text-primary truncate">
              {title}
            </p>
            <p className="text-xs text-sf-text-secondary line-clamp-2">
              {description}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function GeoTab({ data }: { data: SeoData }) {
  const geoScore = data.geoScore;
  const checklist = data.geoChecklist as Record<string, { passed: boolean; suggestions?: string[] }> | null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-sf-text-muted uppercase tracking-wider">
          GEO Score
        </h4>
        <ScoreBadge score={geoScore !== null ? geoScore * 100 : null} />
      </div>

      {geoScore === null && (
        <p className="text-sm text-sf-text-muted">
          Run analysis to see AI search optimization results.
        </p>
      )}

      {checklist && Object.entries(checklist).map(([key, check]) => (
        <div key={key} className="flex items-start gap-2">
          <span
            className={cn(
              "mt-0.5 h-4 w-4 flex-shrink-0 rounded-full flex items-center justify-center text-xs",
              check.passed
                ? "bg-green-500/20 text-green-500"
                : "bg-red-500/20 text-red-500"
            )}
          >
            {check.passed ? "✓" : "✗"}
          </span>
          <div className="min-w-0">
            <p className="text-sm text-sf-text-secondary capitalize">
              {key.replace(/([A-Z])/g, " $1").trim()}
            </p>
            {!check.passed && check.suggestions && check.suggestions.length > 0 && (
              <p className="text-xs text-sf-text-muted mt-0.5">
                {check.suggestions[0]}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

const TABS: { id: SeoTab; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: "overview", label: "Overview", icon: BarChart2 },
  { id: "keywords", label: "Keywords", icon: Tag },
  { id: "readability", label: "Readability", icon: BookOpen },
  { id: "preview", label: "Preview", icon: Eye },
  { id: "geo", label: "GEO", icon: Zap },
];

export function SeoPanel({ postId, refreshKey }: SeoPanelProps) {
  const [activeTab, setActiveTab] = useState<SeoTab>("overview");
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
  }, [postId, refreshKey]);

  if (loading) {
    return (
      <div className="border border-sf-border rounded-sf bg-sf-bg-secondary p-4 space-y-3">
        <SkeletonLine className="w-24" />
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <SkeletonLine key={tab.id} className="flex-1 h-7" />
          ))}
        </div>
        <div className="space-y-2 pt-2">
          <SkeletonLine className="w-full" />
          <SkeletonLine className="w-3/4" />
          <SkeletonLine className="w-1/2" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="border border-sf-border rounded-sf bg-sf-bg-secondary">
      {/* Header */}
      <div className="px-4 pt-4 pb-0">
        <h3 className="text-xs font-semibold text-sf-text-muted uppercase tracking-wider">
          SEO &amp; GEO
        </h3>
      </div>

      {/* Tab Nav */}
      <div className="flex gap-0.5 px-4 pt-3 pb-0 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1 px-2 py-1.5 text-xs rounded-t whitespace-nowrap transition-colors border-b-2",
                isActive
                  ? "text-sf-accent border-sf-accent bg-sf-bg-tertiary"
                  : "text-sf-text-muted border-transparent hover:text-sf-text-secondary hover:bg-sf-bg-tertiary"
              )}
            >
              <Icon size={11} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div className="border-t border-sf-border" />

      {/* Tab Content */}
      <div className="p-4">
        {activeTab === "overview" && <OverviewTab data={data} />}
        {activeTab === "keywords" && <KeywordsTab data={data} />}
        {activeTab === "readability" && <ReadabilityTab data={data} />}
        {activeTab === "preview" && <PreviewTab data={data} />}
        {activeTab === "geo" && <GeoTab data={data} />}
      </div>
    </div>
  );
}
