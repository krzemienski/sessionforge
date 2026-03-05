"use client";

import { useEffect, useState } from "react";
import { Eye, Globe, Search, Twitter, Linkedin } from "lucide-react";
import { cn } from "@/lib/utils";

type PreviewPlatform = "google" | "perplexity" | "twitter" | "linkedin";

interface SeoData {
  metaTitle: string | null;
  metaDescription: string | null;
  ogImage: string | null;
}

interface SeoPreviewProps {
  postId: string;
  /** Optional overrides — when provided, take precedence over fetched data for live preview. */
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: string;
}

function SkeletonLine({ className }: { className?: string }) {
  return (
    <div
      className={cn("h-3 rounded bg-sf-bg-tertiary animate-pulse", className)}
    />
  );
}

// ---------------------------------------------------------------------------
// Google SERP preview
// ---------------------------------------------------------------------------

function GooglePreview({
  title,
  description,
  url,
}: {
  title: string;
  description: string;
  url: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Globe size={11} className="text-sf-text-muted" />
        <span className="text-xs font-medium text-sf-text-muted">
          Google Search Result
        </span>
      </div>

      <div className="border border-sf-border rounded-sf p-3 bg-sf-bg-primary space-y-1">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-sf-bg-tertiary flex-shrink-0" />
          <p className="text-[11px] text-sf-text-muted truncate">{url}</p>
        </div>

        {/* Title */}
        <p
          className="text-base font-medium text-blue-500 leading-snug line-clamp-1 hover:underline cursor-pointer"
          title={title}
        >
          {title}
        </p>

        {/* Description */}
        <p className="text-xs text-sf-text-secondary leading-relaxed line-clamp-2">
          <span className="text-sf-text-muted">
            {new Date().toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}{" "}
            —{" "}
          </span>
          {description}
        </p>
      </div>

      {/* Character count hints */}
      <div className="flex items-center justify-between text-[10px] text-sf-text-muted">
        <span>
          Title:{" "}
          <span
            className={cn(
              title.length > 60 ? "text-red-400" : "text-sf-text-secondary"
            )}
          >
            {title.length}
          </span>
          /60 chars
        </span>
        <span>
          Description:{" "}
          <span
            className={cn(
              description.length > 160
                ? "text-red-400"
                : "text-sf-text-secondary"
            )}
          >
            {description.length}
          </span>
          /160 chars
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Perplexity citation preview
// ---------------------------------------------------------------------------

function PerplexityPreview({
  title,
  description,
  url,
}: {
  title: string;
  description: string;
  url: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Search size={11} className="text-sf-text-muted" />
        <span className="text-xs font-medium text-sf-text-muted">
          Perplexity Citation
        </span>
      </div>

      <div className="border border-sf-border rounded-sf bg-sf-bg-primary overflow-hidden">
        {/* Citation header bar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-sf-border bg-sf-bg-tertiary">
          <span className="text-[10px] font-bold text-sf-text-muted bg-sf-bg-secondary px-1.5 py-0.5 rounded">
            1
          </span>
          <p className="text-[11px] text-sf-text-muted truncate">{url}</p>
        </div>

        {/* Citation body */}
        <div className="p-3 space-y-1.5">
          <p className="text-sm font-medium text-sf-text-primary leading-snug line-clamp-2">
            {title}
          </p>
          <p className="text-xs text-sf-text-secondary leading-relaxed line-clamp-3">
            {description}
          </p>
        </div>
      </div>

      <p className="text-[10px] text-sf-text-muted leading-relaxed">
        AI engines like Perplexity prefer content with clear structure, factual
        density, and concise summaries. Run GEO analysis to improve citation
        chances.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Twitter / X card preview
// ---------------------------------------------------------------------------

function TwitterPreview({
  title,
  description,
  ogImage,
  url,
}: {
  title: string;
  description: string;
  ogImage: string | null;
  url: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Twitter size={11} className="text-sf-text-muted" />
        <span className="text-xs font-medium text-sf-text-muted">
          Twitter / X Card
        </span>
      </div>

      <div className="border border-sf-border rounded-xl overflow-hidden bg-sf-bg-primary max-w-sm">
        {/* OG image */}
        {ogImage ? (
          <img
            src={ogImage}
            alt="Open Graph preview"
            className="w-full h-36 object-cover"
          />
        ) : (
          <div className="w-full h-36 bg-sf-bg-tertiary flex flex-col items-center justify-center gap-1.5">
            <Twitter size={20} className="text-sf-text-muted opacity-40" />
            <span className="text-[10px] text-sf-text-muted">No OG image</span>
          </div>
        )}

        {/* Card body */}
        <div className="px-3 py-2.5 space-y-0.5">
          <p className="text-[11px] text-sf-text-muted uppercase tracking-wide">
            {url}
          </p>
          <p className="text-sm font-semibold text-sf-text-primary leading-snug line-clamp-1">
            {title}
          </p>
          <p className="text-xs text-sf-text-secondary leading-relaxed line-clamp-2">
            {description}
          </p>
        </div>
      </div>

      {!ogImage && (
        <p className="text-[10px] text-yellow-500 leading-relaxed">
          Set an OG image to unlock the large Twitter card format.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LinkedIn card preview
// ---------------------------------------------------------------------------

function LinkedInPreview({
  title,
  description,
  ogImage,
  url,
}: {
  title: string;
  description: string;
  ogImage: string | null;
  url: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Linkedin size={11} className="text-sf-text-muted" />
        <span className="text-xs font-medium text-sf-text-muted">
          LinkedIn Post Preview
        </span>
      </div>

      <div className="border border-sf-border rounded-sf overflow-hidden bg-sf-bg-primary max-w-sm">
        {/* OG image — LinkedIn uses a wider aspect ratio */}
        {ogImage ? (
          <img
            src={ogImage}
            alt="Open Graph preview"
            className="w-full h-40 object-cover"
          />
        ) : (
          <div className="w-full h-40 bg-sf-bg-tertiary flex flex-col items-center justify-center gap-1.5">
            <Linkedin size={20} className="text-sf-text-muted opacity-40" />
            <span className="text-[10px] text-sf-text-muted">No OG image</span>
          </div>
        )}

        {/* Card body */}
        <div className="px-3 py-2.5 space-y-0.5 border-t border-sf-border">
          <p className="text-sm font-semibold text-sf-text-primary leading-snug line-clamp-2">
            {title}
          </p>
          <p className="text-[11px] text-sf-text-muted">{url}</p>
        </div>
      </div>

      <p className="text-[10px] text-sf-text-muted leading-relaxed">
        LinkedIn shows title and domain. The description is hidden unless shared
        as an article.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Platform tab bar
// ---------------------------------------------------------------------------

const PLATFORMS: {
  id: PreviewPlatform;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}[] = [
  { id: "google", label: "Google", icon: Globe },
  { id: "perplexity", label: "Perplexity", icon: Search },
  { id: "twitter", label: "Twitter", icon: Twitter },
  { id: "linkedin", label: "LinkedIn", icon: Linkedin },
];

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function SeoPreview({
  postId,
  metaTitle: titleOverride,
  metaDescription: descriptionOverride,
  ogImage: ogImageOverride,
}: SeoPreviewProps) {
  const [data, setData] = useState<SeoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePlatform, setActivePlatform] =
    useState<PreviewPlatform>("google");

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
        <SkeletonLine className="w-28" />
        <div className="flex gap-1">
          {PLATFORMS.map((p) => (
            <SkeletonLine key={p.id} className="flex-1 h-7" />
          ))}
        </div>
        <SkeletonLine className="w-full h-28 mt-2" />
        <SkeletonLine className="w-3/4" />
        <SkeletonLine className="w-1/2" />
      </div>
    );
  }

  // Merge fetched data with any live overrides from parent
  const title =
    titleOverride ?? data?.metaTitle ?? "No title set";
  const description =
    descriptionOverride ?? data?.metaDescription ?? "No description set.";
  const ogImage = ogImageOverride ?? data?.ogImage ?? null;

  // Placeholder domain — a real integration would derive this from the post's
  // published URL or workspace settings.
  const displayUrl = "yourdomain.com";

  return (
    <div className="border border-sf-border rounded-sf bg-sf-bg-secondary">
      {/* Header */}
      <div className="px-4 pt-4 pb-0">
        <div className="flex items-center gap-1.5">
          <Eye size={13} className="text-sf-text-muted flex-shrink-0" />
          <h3 className="text-xs font-semibold text-sf-text-muted uppercase tracking-wider">
            SEO Previews
          </h3>
        </div>
      </div>

      {/* Platform tab bar */}
      <div className="flex gap-0.5 px-4 pt-3 pb-0 overflow-x-auto">
        {PLATFORMS.map((platform) => {
          const Icon = platform.icon;
          const isActive = activePlatform === platform.id;

          return (
            <button
              key={platform.id}
              onClick={() => setActivePlatform(platform.id)}
              className={cn(
                "flex items-center gap-1 px-2 py-1.5 text-xs rounded-t whitespace-nowrap transition-colors border-b-2",
                isActive
                  ? "text-sf-accent border-sf-accent bg-sf-bg-tertiary"
                  : "text-sf-text-muted border-transparent hover:text-sf-text-secondary hover:bg-sf-bg-tertiary"
              )}
            >
              <Icon size={11} />
              {platform.label}
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div className="border-t border-sf-border" />

      {/* Platform content */}
      <div className="p-4">
        {activePlatform === "google" && (
          <GooglePreview
            title={title}
            description={description}
            url={displayUrl}
          />
        )}
        {activePlatform === "perplexity" && (
          <PerplexityPreview
            title={title}
            description={description}
            url={displayUrl}
          />
        )}
        {activePlatform === "twitter" && (
          <TwitterPreview
            title={title}
            description={description}
            ogImage={ogImage}
            url={displayUrl}
          />
        )}
        {activePlatform === "linkedin" && (
          <LinkedInPreview
            title={title}
            description={description}
            ogImage={ogImage}
            url={displayUrl}
          />
        )}
      </div>
    </div>
  );
}
