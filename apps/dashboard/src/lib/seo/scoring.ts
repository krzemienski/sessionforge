// SeoMetadata mirrors the interface defined in packages/db/src/schema.ts
// Defined locally here so the computation library has no DB package dependency.
export interface SeoMetadata {
  metaTitle?: string | null;
  metaDescription?: string | null;
  focusKeyword?: string | null;
  additionalKeywords?: string[] | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImage?: string | null;
  twitterTitle?: string | null;
  twitterDescription?: string | null;
  twitterCard?: string | null;
  schemaOrg?: Record<string, unknown> | null;
  readabilityScore?: number | null;
  readabilityGrade?: string | null;
  seoScore?: number | null;
  keywordDensity?: number | null;
  suggestedKeywords?: string[] | null;
  generatedAt?: string | null;
}

export interface SeoCheck {
  id: string;
  label: string;
  pass: boolean;
  points: number;
  maxPoints: number;
}

export interface SeoScoreResult {
  total: number;
  checks: SeoCheck[];
  suggestions: string[];
}

function stripMarkdownForKeyword(text: string): string {
  return (
    text
      // Remove fenced code blocks
      .replace(/```[\s\S]*?```/g, " ")
      // Remove inline code
      .replace(/`[^`]*`/g, " ")
      // Remove images
      .replace(/!\[.*?\]\(.*?\)/g, " ")
      // Remove links (keep link text)
      .replace(/\[([^\]]*)\]\(.*?\)/g, "$1")
      // Remove heading markers
      .replace(/^#{1,6}\s+/gm, "")
      // Remove bold/italic
      .replace(/(\*{1,3}|_{1,3})(.*?)\1/g, "$2")
      // Remove blockquote markers
      .replace(/^>\s*/gm, "")
      // Remove horizontal rules
      .replace(/^[-*_]{3,}\s*$/gm, " ")
      // Remove unordered list markers
      .replace(/^[\s]*[-*+]\s+/gm, "")
      // Remove ordered list markers
      .replace(/^[\s]*\d+\.\s+/gm, "")
      // Remove HTML tags
      .replace(/<[^>]+>/g, " ")
      // Collapse whitespace
      .replace(/\s+/g, " ")
      .trim()
  );
}

function scoreMetaTitle(seo?: SeoMetadata): { points: number; pass: boolean } {
  const title = seo?.metaTitle;
  if (!title || title.trim().length === 0) {
    return { points: 0, pass: false };
  }
  const len = title.trim().length;
  if (len >= 50 && len <= 60) {
    return { points: 20, pass: true };
  }
  if ((len >= 40 && len < 50) || (len > 60 && len <= 70)) {
    return { points: 10, pass: false };
  }
  return { points: 5, pass: false };
}

function scoreMetaDescription(seo?: SeoMetadata): { points: number; pass: boolean } {
  const desc = seo?.metaDescription;
  if (!desc || desc.trim().length === 0) {
    return { points: 0, pass: false };
  }
  const len = desc.trim().length;
  if (len >= 145 && len <= 155) {
    return { points: 20, pass: true };
  }
  if ((len >= 120 && len < 145) || (len > 155 && len <= 170)) {
    return { points: 10, pass: false };
  }
  return { points: 5, pass: false };
}

export function computeSeoScore(
  markdown: string,
  title: string,
  seo?: SeoMetadata
): SeoScoreResult {
  const checks: SeoCheck[] = [];
  const suggestions: string[] = [];

  // 1. Meta title completeness (0–20 pts, optimal: 50–60 chars)
  const metaTitleScore = scoreMetaTitle(seo);
  checks.push({
    id: "meta-title",
    label: "Meta title (50–60 characters)",
    pass: metaTitleScore.pass,
    points: metaTitleScore.points,
    maxPoints: 20,
  });
  if (!metaTitleScore.pass) {
    if (!seo?.metaTitle?.trim()) {
      suggestions.push("Add a meta title to improve SEO. Aim for 50–60 characters.");
    } else {
      const len = seo.metaTitle.trim().length;
      if (len < 50) {
        suggestions.push(
          `Your meta title is ${len} characters. Expand it to 50–60 characters for best SEO impact.`
        );
      } else if (len > 60) {
        suggestions.push(
          `Your meta title is ${len} characters. Shorten it to 50–60 characters to avoid truncation in search results.`
        );
      }
    }
  }

  // 2. Meta description completeness (0–20 pts, optimal: 145–155 chars)
  const metaDescScore = scoreMetaDescription(seo);
  checks.push({
    id: "meta-description",
    label: "Meta description (145–155 characters)",
    pass: metaDescScore.pass,
    points: metaDescScore.points,
    maxPoints: 20,
  });
  if (!metaDescScore.pass) {
    if (!seo?.metaDescription?.trim()) {
      suggestions.push(
        "Add a meta description to improve click-through rates. Aim for 145–155 characters."
      );
    } else {
      const len = seo.metaDescription.trim().length;
      if (len < 145) {
        suggestions.push(
          `Your meta description is ${len} characters. Expand it to 145–155 characters for best SEO impact.`
        );
      } else if (len > 155) {
        suggestions.push(
          `Your meta description is ${len} characters. Shorten it to 145–155 characters to avoid truncation.`
        );
      }
    }
  }

  // 3. Focus keyword in title (10 pts)
  const focusKeyword = seo?.focusKeyword?.trim().toLowerCase() ?? "";
  const titleLower = title.toLowerCase();
  const keywordInTitle = focusKeyword.length > 0 && titleLower.includes(focusKeyword);
  checks.push({
    id: "keyword-in-title",
    label: "Focus keyword in post title",
    pass: keywordInTitle,
    points: keywordInTitle ? 10 : 0,
    maxPoints: 10,
  });
  if (!keywordInTitle) {
    if (focusKeyword.length === 0) {
      suggestions.push("Set a focus keyword to enable keyword usage scoring.");
    } else {
      suggestions.push(
        `Include the focus keyword "${seo?.focusKeyword}" in your post title.`
      );
    }
  }

  // 4. Focus keyword in first 100 words (10 pts)
  const strippedText = stripMarkdownForKeyword(markdown);
  const allWords = strippedText.split(/\s+/).filter(Boolean);
  const first100 = allWords.slice(0, 100).join(" ").toLowerCase();
  const keywordInIntro = focusKeyword.length > 0 && first100.includes(focusKeyword);
  checks.push({
    id: "keyword-in-intro",
    label: "Focus keyword in first 100 words",
    pass: keywordInIntro,
    points: keywordInIntro ? 10 : 0,
    maxPoints: 10,
  });
  if (!keywordInIntro && focusKeyword.length > 0) {
    suggestions.push(
      `Mention the focus keyword "${seo?.focusKeyword}" within the first 100 words of your post.`
    );
  }

  // 5. H1 heading present (10 pts)
  const hasH1 = /^#\s+.+/m.test(markdown);
  checks.push({
    id: "h1-heading",
    label: "H1 heading present",
    pass: hasH1,
    points: hasH1 ? 10 : 0,
    maxPoints: 10,
  });
  if (!hasH1) {
    suggestions.push(
      "Add an H1 heading (# Your Title) to your post. It is a strong on-page SEO signal."
    );
  }

  // 6. H2+ subheadings count >= 2 (10 pts)
  const subheadingMatches = markdown.match(/^#{2,6}\s+.+/gm) ?? [];
  const subheadingCount = subheadingMatches.length;
  const hasEnoughSubheadings = subheadingCount >= 2;
  checks.push({
    id: "subheadings",
    label: "At least 2 subheadings (H2–H6)",
    pass: hasEnoughSubheadings,
    points: hasEnoughSubheadings ? 10 : 0,
    maxPoints: 10,
  });
  if (!hasEnoughSubheadings) {
    suggestions.push(
      `Add at least 2 subheadings (## Section) to improve content structure. Currently found ${subheadingCount}.`
    );
  }

  // 7. Word count >= 800 (10 pts)
  const wordCount = markdown.split(/\s+/).filter(Boolean).length;
  const hasEnoughWords = wordCount >= 800;
  checks.push({
    id: "word-count",
    label: "Word count ≥ 800",
    pass: hasEnoughWords,
    points: hasEnoughWords ? 10 : 0,
    maxPoints: 10,
  });
  if (!hasEnoughWords) {
    suggestions.push(
      `Your post has ${wordCount} words. Aim for at least 800 words for comprehensive coverage and better search rankings.`
    );
  }

  // 8. OG + Twitter fields all set (10 pts)
  const ogTwitterComplete =
    !!seo?.ogTitle?.trim() &&
    !!seo?.ogDescription?.trim() &&
    !!seo?.twitterTitle?.trim() &&
    !!seo?.twitterDescription?.trim();
  checks.push({
    id: "og-twitter",
    label: "Open Graph & Twitter Card fields set",
    pass: ogTwitterComplete,
    points: ogTwitterComplete ? 10 : 0,
    maxPoints: 10,
  });
  if (!ogTwitterComplete) {
    const missing: string[] = [];
    if (!seo?.ogTitle?.trim()) missing.push("OG title");
    if (!seo?.ogDescription?.trim()) missing.push("OG description");
    if (!seo?.twitterTitle?.trim()) missing.push("Twitter title");
    if (!seo?.twitterDescription?.trim()) missing.push("Twitter description");
    suggestions.push(
      `Set the following social sharing fields for better previews: ${missing.join(", ")}.`
    );
  }

  const total = checks.reduce((sum, check) => sum + check.points, 0);

  return { total, checks, suggestions };
}
