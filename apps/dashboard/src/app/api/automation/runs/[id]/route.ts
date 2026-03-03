import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { automationRuns } from "@sessionforge/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const run = await db.query.automationRuns.findFirst({
    where: eq(automationRuns.id, id),
    with: { trigger: true, workspace: true },
  });

  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  if (run.workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const { trigger, workspace: _workspace, ...runData } = run;

  return NextResponse.json({
    ...runData,
    triggerName: trigger?.name ?? null,
  });
}
