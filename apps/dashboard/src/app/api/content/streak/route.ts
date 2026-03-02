import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts, workspaces } from "@sessionforge/db";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

type Post = typeof posts.$inferSelect & { publishedAt?: Date | null };

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const workspaceSlug = searchParams.get("workspace");

  if (!workspaceSlug) {
    return NextResponse.json({ error: "workspace query param required" }, { status: 400 });
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, workspaceSlug),
  });

  if (!workspace || workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const publishedPosts = (await db.query.posts.findMany({
    where: and(
      eq(posts.workspaceId, workspace.id),
      eq(posts.status, "published")
    ),
  })) as Post[];

  const publishedDates = new Set<string>();
  for (const post of publishedPosts) {
    const date = post.publishedAt ?? post.updatedAt ?? post.createdAt;
    if (date) {
      publishedDates.add(toDateKey(date));
    }
  }

  let streak = 0;
  const candidate = new Date();
  candidate.setHours(0, 0, 0, 0);

  while (publishedDates.has(toDateKey(candidate))) {
    streak++;
    candidate.setDate(candidate.getDate() - 1);
  }

  return NextResponse.json({
    streak,
    publishedDates: Array.from(publishedDates).sort(),
  });
}
