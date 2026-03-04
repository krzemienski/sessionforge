import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posts, workspaces, contentTriggers } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";

export const dynamic = "force-dynamic";

type Post = typeof posts.$inferSelect & { publishedAt?: Date | null };

function getPostDate(post: Post): Date {
  if (post.status === "published") {
    return post.publishedAt ?? post.updatedAt ?? post.createdAt ?? new Date(0);
  }
  return post.createdAt ?? new Date(0);
}

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function computeNextRun(cronExpression: string, from: Date = new Date()): string | null {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) return null;

  const [minuteExpr, hourExpr, domExpr, monthExpr, dowExpr] = parts;

  function parseField(expr: string, min: number, max: number): number[] {
    if (expr === "*") {
      const values: number[] = [];
      for (let i = min; i <= max; i++) values.push(i);
      return values;
    }
    return expr.split(",").map(Number).filter((n) => !isNaN(n) && n >= min && n <= max);
  }

  const minutes = parseField(minuteExpr, 0, 59);
  const hours = parseField(hourExpr, 0, 23);
  const doms = parseField(domExpr, 1, 31);
  const months = parseField(monthExpr, 1, 12);
  const dows = parseField(dowExpr, 0, 6);

  if (!minutes.length || !hours.length || !months.length) return null;

  const candidate = new Date(from);
  candidate.setSeconds(0, 0);
  candidate.setMinutes(candidate.getMinutes() + 1);

  const limit = new Date(from);
  limit.setFullYear(limit.getFullYear() + 1);

  while (candidate < limit) {
    const m = candidate.getMonth() + 1;
    if (!months.includes(m)) {
      candidate.setDate(1);
      candidate.setHours(0, 0, 0, 0);
      candidate.setMonth(candidate.getMonth() + 1);
      continue;
    }

    const dom = candidate.getDate();
    const dow = candidate.getDay();
    const isDomWild = domExpr === "*";
    const isDowWild = dowExpr === "*";

    let dayMatch: boolean;
    if (!isDomWild && !isDowWild) {
      dayMatch = doms.includes(dom) || dows.includes(dow);
    } else if (!isDomWild) {
      dayMatch = doms.includes(dom);
    } else if (!isDowWild) {
      dayMatch = dows.includes(dow);
    } else {
      dayMatch = true;
    }

    if (!dayMatch) {
      candidate.setDate(candidate.getDate() + 1);
      candidate.setHours(0, 0, 0, 0);
      continue;
    }

    const hour = candidate.getHours();
    if (!hours.includes(hour)) {
      const nextHour = hours.find((h) => h > hour);
      if (nextHour === undefined) {
        candidate.setDate(candidate.getDate() + 1);
        candidate.setHours(0, 0, 0, 0);
      } else {
        candidate.setHours(nextHour, 0, 0, 0);
      }
      continue;
    }

    const minute = candidate.getMinutes();
    const nextMinute = minutes.find((mm) => mm >= minute);
    if (nextMinute === undefined) {
      const nextHour = hours.find((h) => h > hour);
      if (nextHour === undefined) {
        candidate.setDate(candidate.getDate() + 1);
        candidate.setHours(0, 0, 0, 0);
      } else {
        candidate.setHours(nextHour, 0, 0, 0);
      }
      continue;
    }

    candidate.setMinutes(nextMinute);
    return candidate.toISOString();
  }

  return null;
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const workspaceSlug = searchParams.get("workspace");
  const yearParam = searchParams.get("year");
  const monthParam = searchParams.get("month");

  if (!workspaceSlug) {
    return NextResponse.json({ error: "workspace query param required" }, { status: 400 });
  }

  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();
  const month = monthParam ? parseInt(monthParam, 10) : new Date().getMonth() + 1;

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid year or month" }, { status: 400 });
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, workspaceSlug),
  });

  if (!workspace || workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const startOfMonth = new Date(year, month - 1, 1);
  const startOfNextMonth = new Date(year, month, 1);

  const allPosts = await db.query.posts.findMany({
    where: eq(posts.workspaceId, workspace.id),
  });

  const triggers = await db.query.contentTriggers.findMany({
    where: eq(contentTriggers.workspaceId, workspace.id),
  });

  const days: Record<string, { posts: Post[] }> = {};

  for (const post of allPosts) {
    const postDate = getPostDate(post);
    if (postDate < startOfMonth || postDate >= startOfNextMonth) continue;

    const key = toDateKey(postDate);
    if (!days[key]) {
      days[key] = { posts: [] };
    }
    days[key].posts.push(post);
  }

  const now = new Date();
  const nextRuns: Record<string, string> = {};

  for (const trigger of triggers) {
    if (trigger.cronExpression && trigger.enabled) {
      const nextRun = computeNextRun(trigger.cronExpression, now);
      if (nextRun) {
        nextRuns[trigger.id] = nextRun;
      }
    }
  }

  return NextResponse.json({ days, triggers, nextRuns });
}
