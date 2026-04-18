"use client";

import dynamic from "next/dynamic";

/**
 * Each preview pulls in a heavy rendering stack (BlogPostPreview alone
 * statically imports react-markdown + remark-gfm + rehype-highlight, plus a
 * lazy mermaid loader). Only one preview renders at a time per content type,
 * so we lazy-load them so the editor route doesn't ship all three bundles
 * up-front (review finding H7).
 */
const BlogPostPreview = dynamic(
  () => import("./blog-post-preview").then((m) => m.BlogPostPreview),
  { ssr: false },
);
const TwitterThreadPreview = dynamic(
  () => import("./twitter-thread-preview").then((m) => m.TwitterThreadPreview),
  { ssr: false },
);
const LinkedInPreview = dynamic(
  () => import("./linkedin-preview").then((m) => m.LinkedInPreview),
  { ssr: false },
);

export type ContentType =
  | "blog_post"
  | "devto_post"
  | "changelog"
  | "newsletter"
  | "custom"
  | "twitter_thread"
  | "linkedin_post";

export interface ContentPreviewProps {
  markdown: string;
  contentType: ContentType | string;
  onCitationClick?: (type: string, label: string) => void;
}

export function ContentPreview({ markdown, contentType, onCitationClick }: ContentPreviewProps) {
  if (contentType === "twitter_thread") {
    return <TwitterThreadPreview markdown={markdown} />;
  }

  if (contentType === "linkedin_post") {
    return <LinkedInPreview markdown={markdown} />;
  }

  return <BlogPostPreview markdown={markdown} onCitationClick={onCitationClick} />;
}
