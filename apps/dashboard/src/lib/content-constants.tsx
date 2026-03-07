import { cn } from "@/lib/utils";

export const STATUS_COLORS: Record<string, string> = {
  idea: "text-sf-text-muted bg-sf-bg-tertiary",
  draft: "text-sf-info bg-sf-info/10",
  in_review: "text-sf-warning bg-sf-warning/10",
  published: "text-sf-success bg-sf-success/10",
  archived: "text-sf-text-muted bg-sf-bg-tertiary",
};

export const TYPE_LABELS: Record<string, string> = {
  blog_post: "Blog Post",
  twitter_thread: "Twitter Thread",
  linkedin_post: "LinkedIn Post",
  changelog: "Changelog",
  newsletter: "Newsletter",
  devto_post: "Dev.to Post",
  custom: "Custom",
};

export const STATUS_TABS = [
  { label: "All", value: "" },
  { label: "Ideas", value: "idea" },
  { label: "Drafts", value: "draft" },
  { label: "In Review", value: "in_review" },
  { label: "Published", value: "published" },
  { label: "Archived", value: "archived" },
];

export function getSeoScoreColor(score: number): string {
  if (score >= 70) return "text-sf-success bg-sf-success/10";
  if (score >= 40) return "text-sf-warning bg-sf-warning/10";
  return "text-sf-error bg-sf-error/10";
}

export function SeoScoreBadge({ post }: { post: any }) {
  const score: number | undefined = post.seoAnalysis?.compositeScore ?? post.geoScore ?? undefined;
  if (score === undefined || score === null) return null;
  const rounded = Math.round(score);
  return (
    <span className={cn("px-2 py-0.5 rounded-sf-full text-xs font-medium", getSeoScoreColor(rounded))}>
      SEO {rounded}
    </span>
  );
}
