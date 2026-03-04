import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getRedis } from "@/lib/redis";
import { workspaces, platformSettings, contentMetrics } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";

export const dynamic = "force-dynamic";

const REDIS_TTL_SECONDS = 60 * 60 * 24; // 24 hours

interface DevtoArticle {
  id: number;
  title: string;
  url: string;
  page_views_count: number;
  positive_reactions_count: number;
  comments_count: number;
  published_at: string | null;
}

interface HashnodePost {
  id: string;
  title: string;
  url: string;
  views: number;
  reactionCount: number;
  publishedAt: string | null;
}

async function fetchDevtoArticles(apiKey: string): Promise<DevtoArticle[]> {
  const response = await fetch("https://dev.to/api/articles/me?per_page=1000", {
    headers: { "api-key": apiKey },
  });
  if (!response.ok) throw new Error(`Dev.to API error: ${response.status}`);
  return response.json() as Promise<DevtoArticle[]>;
}

async function fetchHashnodePosts(apiKey: string): Promise<HashnodePost[]> {
  const query = `
    query {
      me {
        publications(first: 1) {
          edges {
            node {
              posts(first: 50) {
                edges {
                  node {
                    id
                    title
                    url
                    views
                    reactionCount
                    publishedAt
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const response = await fetch("https://gql.hashnode.com/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) throw new Error(`Hashnode API error: ${response.status}`);

  const data = (await response.json()) as {
    data?: { me?: { publications?: { edges?: { node?: { posts?: { edges?: { node: HashnodePost }[] } } }[] } } };
  };

  const publications = data?.data?.me?.publications?.edges ?? [];
  if (!publications.length) return [];

  const edges = publications[0]?.node?.posts?.edges ?? [];
  return edges.map((edge) => edge.node);
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const start = Date.now();
  const redis = await getRedis();

  const workspace = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.ownerId, session.user.id))
    .limit(1);

  if (!workspace.length) {
    return NextResponse.json({ error: "No workspace found" }, { status: 404 });
  }

  const ws = workspace[0];

  const settings = await db.query.platformSettings.findFirst({
    where: eq(platformSettings.workspaceId, ws.id),
  });

  if (!settings) {
    return NextResponse.json({ error: "No platform settings configured" }, { status: 400 });
  }

  const results = {
    devto: { synced: 0, cached: false, error: null as string | null },
    hashnode: { synced: 0, cached: false, error: null as string | null },
  };

  // ── Dev.to sync ──
  if (settings.devtoApiKey) {
    const cacheKey = `devto:${ws.id}`;
    try {
      const cached = redis ? await redis.get<DevtoArticle[]>(cacheKey) : null;

      if (cached) {
        results.devto.cached = true;
      } else {
        const articles = await fetchDevtoArticles(settings.devtoApiKey);
        if (redis) await redis.set(cacheKey, articles, { ex: REDIS_TTL_SECONDS });

        const rows = articles.map((article) => ({
          workspaceId: ws.id,
          platform: "devto" as const,
          externalId: String(article.id),
          title: article.title,
          url: article.url,
          views: article.page_views_count ?? 0,
          reactions: article.positive_reactions_count ?? 0,
          comments: article.comments_count ?? 0,
          likes: 0,
          publishedAt: article.published_at ? new Date(article.published_at) : null,
        }));

        if (rows.length) {
          await db.insert(contentMetrics).values(rows);
          results.devto.synced = rows.length;
        }
      }
    } catch (err) {
      results.devto.error = err instanceof Error ? err.message : "Unknown error";
    }
  }

  // ── Hashnode sync ──
  if (settings.hashnodeApiKey) {
    const cacheKey = `hashnode:${ws.id}`;
    try {
      const cached = redis ? await redis.get<HashnodePost[]>(cacheKey) : null;

      if (cached) {
        results.hashnode.cached = true;
      } else {
        const posts = await fetchHashnodePosts(settings.hashnodeApiKey);
        if (redis) await redis.set(cacheKey, posts, { ex: REDIS_TTL_SECONDS });

        const rows = posts.map((post) => ({
          workspaceId: ws.id,
          platform: "hashnode" as const,
          externalId: post.id,
          title: post.title,
          url: post.url,
          views: post.views ?? 0,
          reactions: 0,
          comments: 0,
          likes: post.reactionCount ?? 0,
          publishedAt: post.publishedAt ? new Date(post.publishedAt) : null,
        }));

        if (rows.length) {
          await db.insert(contentMetrics).values(rows);
          results.hashnode.synced = rows.length;
        }
      }
    } catch (err) {
      results.hashnode.error = err instanceof Error ? err.message : "Unknown error";
    }
  }

  return NextResponse.json({
    devto: results.devto,
    hashnode: results.hashnode,
    durationMs: Date.now() - start,
  });
}
