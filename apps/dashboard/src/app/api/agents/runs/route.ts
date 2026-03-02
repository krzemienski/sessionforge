import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces } from "@sessionforge/db";
import { eq, desc, and } from "drizzle-orm";
import { agentRuns } from "../../../../../../../packages/db/src/schema";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const workspaceSlug = searchParams.get("workspace");
  const agentType = searchParams.get("agentType");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);

  if (!workspaceSlug) {
    return NextResponse.json({ error: "workspace query param required" }, { status: 400 });
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, workspaceSlug),
  });

  if (!workspace || workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const conditions = [eq(agentRuns.workspaceId, workspace.id)];
  if (agentType) {
    conditions.push(
      eq(agentRuns.agentType, agentType as typeof agentRuns.agentType.enumValues[number])
    );
  }

  const runs = await db
    .select()
    .from(agentRuns)
    .where(and(...conditions))
    .orderBy(desc(agentRuns.startedAt))
    .limit(limit);

  return NextResponse.json({ runs });
}
