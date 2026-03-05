import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { insights, workspaces } from "@sessionforge/db";
import { eq, desc, and, gte } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const workspaceSlug = searchParams.get("workspace");
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);
  const minScore = parseFloat(searchParams.get("minScore") ?? "0");

  if (!workspaceSlug) {
    return NextResponse.json({ error: "workspace query param required" }, { status: 400 });
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, workspaceSlug),
  });

  if (!workspace || workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const conditions = [eq(insights.workspaceId, workspace.id)];
  if (minScore > 0) {
    conditions.push(gte(insights.compositeScore, minScore));
  }

  const results = await db.query.insights.findMany({
    where: and(...conditions),
    orderBy: [desc(insights.compositeScore)],
    limit,
    offset,
  });

  return NextResponse.json({ insights: results, limit, offset });
}
