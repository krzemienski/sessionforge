import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces, portfolioSettings, posts } from "@sessionforge/db";
import { eq, and } from "drizzle-orm/sql";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspace: string }> }
) {
  const { workspace: workspaceSlug } = await params;

  // Look up workspace by slug
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, workspaceSlug),
  });

  if (!workspace) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Look up portfolio settings
  const portfolio = await db.query.portfolioSettings.findFirst({
    where: eq(portfolioSettings.workspaceId, workspace.id),
  });

  // When the portfolio is disabled or RSS opt-out, still return a well-formed
  // but empty RSS feed (not 404) so subscribed feed readers don't choke and so
  // existing publications that link to /rss don't break.
  const rssAllowed = !!portfolio && portfolio.isEnabled && portfolio.showRss;

  // Get published posts for this workspace (empty if RSS disabled)
  const publishedPosts = rssAllowed
    ? await db.query.posts.findMany({
        where: and(
          eq(posts.workspaceId, workspace.id),
          eq(posts.status, "published")
        ),
        orderBy: (p, { desc }) => [desc(p.publishedAt)],
        limit: 50, // Limit to most recent 50 posts
      })
    : [];

  // Build RSS feed XML
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const portfolioUrl = `${baseUrl}/p/${workspaceSlug}`;

  // Escape XML special characters
  const escapeXml = (unsafe: string | null | undefined): string => {
    if (!unsafe) return "";
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  };

  // Generate RSS items
  const rssItems = publishedPosts
    .map((post) => {
      const postUrl = `${portfolioUrl}#post-${post.id}`;
      const pubDate = post.publishedAt
        ? new Date(post.publishedAt).toUTCString()
        : post.createdAt
          ? new Date(post.createdAt).toUTCString()
          : new Date().toUTCString();

      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(postUrl)}</link>
      <guid isPermaLink="true">${escapeXml(postUrl)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(post.metaDescription || "")}</description>
    </item>`;
    })
    .join("\n");

  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(workspace.name)}</title>
    <link>${escapeXml(portfolioUrl)}</link>
    <description>${escapeXml(portfolio?.bio || `${workspace.name}'s portfolio`)}</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(`${baseUrl}/api/public/portfolio/${workspaceSlug}/rss`)}" rel="self" type="application/rss+xml" />
${rssItems}
  </channel>
</rss>`;

  return new NextResponse(rssXml, {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
    },
  });
}
