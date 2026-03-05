import { db } from "@/lib/db";
import { posts, workspaces, series, seriesPosts } from "@sessionforge/db";
import { eq, desc, and, inArray } from "drizzle-orm/sql";
import { marked } from "marked";

export const dynamic = "force-dynamic";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toRfc822(date: Date | null | undefined): string {
  if (!date) return new Date().toUTCString();
  return date.toUTCString();
}

function toIso8601(date: Date | null | undefined): string {
  if (!date) return new Date().toISOString();
  return date.toISOString();
}

function buildRss(
  workspaceName: string,
  workspaceSlug: string,
  baseUrl: string,
  feedItems: { title: string; id: string; createdAt: Date | null; htmlContent: string }[],
  seriesTitle?: string,
  seriesSlug?: string
): string {
  const channelLink = `${baseUrl}/${workspaceSlug}`;
  const selfLink = seriesSlug
    ? `${baseUrl}/api/feed/${workspaceSlug}/series/${seriesSlug}.xml`
    : `${baseUrl}/api/feed/${workspaceSlug}.xml`;
  const lastBuildDate = feedItems.length > 0 ? toRfc822(feedItems[0].createdAt) : toRfc822(new Date());
  const feedTitle = seriesTitle ? `${workspaceName} - ${seriesTitle}` : workspaceName;
  const feedDescription = seriesTitle
    ? `Posts from the "${seriesTitle}" series on ${workspaceName}`
    : `Published posts from ${workspaceName} on SessionForge`;

  const items = feedItems
    .map((item) => {
      const itemLink = `${baseUrl}/${workspaceSlug}/content/${item.id}`;
      return `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(itemLink)}</link>
      <guid isPermaLink="true">${escapeXml(itemLink)}</guid>
      <pubDate>${toRfc822(item.createdAt)}</pubDate>
      <content:encoded><![CDATA[${safeCdata(item.htmlContent)}]]></content:encoded>
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(feedTitle)}</title>
    <link>${escapeXml(channelLink)}</link>
    <description>${escapeXml(feedDescription)}</description>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${escapeXml(selfLink)}" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;
}

function safeCdata(html: string): string {
  // Prevent CDATA section from being prematurely closed by ]]> in content
  return html.replace(/]]>/g, "]]]]><![CDATA[>");
}

function buildAtom(
  workspaceName: string,
  workspaceSlug: string,
  baseUrl: string,
  feedItems: { title: string; id: string; createdAt: Date | null; updatedAt: Date | null; htmlContent: string }[],
  seriesTitle?: string,
  seriesSlug?: string
): string {
  const feedId = seriesSlug
    ? `${baseUrl}/api/feed/${workspaceSlug}/series/${seriesSlug}.atom`
    : `${baseUrl}/api/feed/${workspaceSlug}.atom`;
  const channelLink = `${baseUrl}/${workspaceSlug}`;
  const updated = feedItems.length > 0 ? toIso8601(feedItems[0].updatedAt ?? feedItems[0].createdAt) : toIso8601(new Date());
  const feedTitle = seriesTitle ? `${workspaceName} - ${seriesTitle}` : workspaceName;
  const feedSubtitle = seriesTitle
    ? `Posts from the "${seriesTitle}" series on ${workspaceName}`
    : `Published posts from ${workspaceName} on SessionForge`;

  const entries = feedItems
    .map((item) => {
      const entryId = `${baseUrl}/${workspaceSlug}/content/${item.id}`;
      return `  <entry>
    <title>${escapeXml(item.title)}</title>
    <id>${escapeXml(entryId)}</id>
    <link href="${escapeXml(entryId)}"/>
    <published>${toIso8601(item.createdAt)}</published>
    <updated>${toIso8601(item.updatedAt ?? item.createdAt)}</updated>
    <content type="html"><![CDATA[${safeCdata(item.htmlContent)}]]></content>
  </entry>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(feedTitle)}</title>
  <subtitle>${escapeXml(feedSubtitle)}</subtitle>
  <id>${escapeXml(feedId)}</id>
  <link href="${escapeXml(channelLink)}"/>
  <link href="${escapeXml(feedId)}" rel="self"/>
  <updated>${updated}</updated>
  <author><name>${escapeXml(workspaceName)}</name></author>
${entries}
</feed>`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const slugStr = slug.join("/");

  let workspaceSlug: string;
  let seriesSlug: string | undefined;
  let format: "rss" | "atom";

  // Parse format (xml/atom)
  if (slugStr.endsWith(".atom")) {
    workspaceSlug = slugStr.slice(0, -5);
    format = "atom";
  } else if (slugStr.endsWith(".xml")) {
    workspaceSlug = slugStr.slice(0, -4);
    format = "rss";
  } else {
    workspaceSlug = slugStr;
    format = "rss";
  }

  // Parse series slug if present
  // Pattern: workspace/series/series-slug
  const seriesMatch = workspaceSlug.match(/^([^/]+)\/series\/(.+)$/);
  if (seriesMatch) {
    workspaceSlug = seriesMatch[1];
    seriesSlug = seriesMatch[2];
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, workspaceSlug),
  });

  if (!workspace) {
    return new Response("Workspace not found", { status: 404 });
  }

  let seriesData: typeof series.$inferSelect | undefined;
  let publishedPosts: (typeof posts.$inferSelect)[];

  if (seriesSlug) {
    // Query for series and filter posts
    seriesData = await db.query.series.findFirst({
      where: and(
        eq(series.workspaceId, workspace.id),
        eq(series.slug, seriesSlug)
      ),
    });

    if (!seriesData) {
      return new Response("Series not found", { status: 404 });
    }

    // Get all post IDs in this series
    const seriesPostsData = await db.query.seriesPosts.findMany({
      where: eq(seriesPosts.seriesId, seriesData.id),
      orderBy: [desc(seriesPosts.order)],
    });

    const postIds = seriesPostsData.map((sp) => sp.postId);

    if (postIds.length === 0) {
      publishedPosts = [];
    } else {
      // Get published posts from this series
      publishedPosts = await db.query.posts.findMany({
        where: and(
          eq(posts.workspaceId, workspace.id),
          eq(posts.status, "published"),
          inArray(posts.id, postIds)
        ),
        orderBy: [desc(posts.createdAt)],
        limit: 50,
      });
    }
  } else {
    // Query all published posts for workspace
    publishedPosts = await db.query.posts.findMany({
      where: and(
        eq(posts.workspaceId, workspace.id),
        eq(posts.status, "published")
      ),
      orderBy: [desc(posts.createdAt)],
      limit: 50,
    });
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

  const feedItems = await Promise.all(
    publishedPosts.map(async (post) => ({
      title: post.title,
      id: post.id,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      htmlContent: await marked(post.markdown ?? ""),
    }))
  );

  if (format === "atom") {
    const xml = buildAtom(
      workspace.name,
      workspaceSlug,
      baseUrl,
      feedItems,
      seriesData?.title,
      seriesSlug
    );
    return new Response(xml, {
      status: 200,
      headers: { "Content-Type": "application/atom+xml; charset=utf-8" },
    });
  }

  const xml = buildRss(
    workspace.name,
    workspaceSlug,
    baseUrl,
    feedItems,
    seriesData?.title,
    seriesSlug
  );
  return new Response(xml, {
    status: 200,
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
