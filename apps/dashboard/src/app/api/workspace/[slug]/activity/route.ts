import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces, workspaceActivity } from "@sessionforge/db";
import { eq, and, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;

  // Get workspace
  const workspace = await db
    .select()
    .from(workspaces)
    .where(
      and(
        eq(workspaces.ownerId, session.user.id),
        eq(workspaces.slug, slug)
      )
    )
    .limit(1);

  if (!workspace.length) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  // Get upload activity (last 10)
  const activity = await db
    .select()
    .from(workspaceActivity)
    .where(
      and(
        eq(workspaceActivity.workspaceId, workspace[0].id),
        eq(workspaceActivity.action, "session_upload")
      )
    )
    .orderBy(desc(workspaceActivity.createdAt))
    .limit(10);

  return NextResponse.json(activity);
}
