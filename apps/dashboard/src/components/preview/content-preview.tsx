"use client";

import { BlogPostPreview } from "./blog-post-preview";
import { TwitterThreadPreview } from "./twitter-thread-preview";
import { LinkedInPreview } from "./linkedin-preview";

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

  // blog_post, devto_post, changelog, newsletter, custom — all use rich markdown rendering
  return <BlogPostPreview markdown={markdown} onCitationClick={onCitationClick} />;
}
