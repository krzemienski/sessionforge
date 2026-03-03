import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { claudeSessions, insights, posts, workspaces } from "@sessionforge/db";
import { eq, ilike, or, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

const RESULTS_PER_TYPE = 5;

function extractSnippet(text: string | null | undefined, query: string, maxLength = 120): string {
  if (!text) return "";
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, maxLength);
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + query.length + 80);
  const snippet = text.slice(start, end);
  return (start > 0 ? "…" : "") + snippet + (end < text.length ? "…" : "");
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const workspaceSlug = searchParams.get("workspace");
  const query = searchParams.get("q")?.trim();

  if (!workspaceSlug) {
    return NextResponse.json({ error: "workspace query param required" }, { status: 400 });
  }

  if (!query) {
    return NextResponse.json({ error: "q query param required" }, { status: 400 });
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, workspaceSlug),
  });

  if (!workspace || workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const pattern = `%${query}%`;

  const [sessionResults, insightResults, contentResults] = await Promise.all([
    db.query.claudeSessions.findMany({
      where: and(
        eq(claudeSessions.workspaceId, workspace.id),
        or(
          ilike(claudeSessions.projectName, pattern),
          ilike(claudeSessions.summary, pattern)
        )
      ),
      limit: RESULTS_PER_TYPE,
    }),
    db.query.insights.findMany({
      where: and(
        eq(insights.workspaceId, workspace.id),
        or(
          ilike(insights.title, pattern),
          ilike(insights.description, pattern)
        )
      ),
      limit: RESULTS_PER_TYPE,
    }),
    db.query.posts.findMany({
      where: and(
        eq(posts.workspaceId, workspace.id),
        or(
          ilike(posts.title, pattern),
          ilike(posts.markdown, pattern)
        )
      ),
      limit: RESULTS_PER_TYPE,
    }),
  ]);

  const sessions = sessionResults.map((s) => ({
    ...s,
    snippet: extractSnippet(s.summary ?? s.projectName, query),
  }));

  const insightsWithSnippets = insightResults.map((i) => ({
    ...i,
    snippet: extractSnippet(i.description ?? i.title, query),
  }));

  const content = contentResults.map((p) => ({
    ...p,
    snippet: extractSnippet(p.markdown ?? p.title, query),
  }));

  const totalCount = sessions.length + insightsWithSnippets.length + content.length;

  return NextResponse.json({
    sessions,
    insights: insightsWithSnippets,
    content,
    totalCount,
  });
}
