import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { streamRecommendationsAnalyzer } from "@/lib/ai/agents/recommendations-analyzer";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { workspaceSlug, customInstructions } = body;

  if (!workspaceSlug) {
    return NextResponse.json(
      { error: "workspaceSlug is required" },
      { status: 400 }
    );
  }

  const { workspace } = await getAuthorizedWorkspace(
    session,
    workspaceSlug,
    PERMISSIONS.CONTENT_READ
  );

  return streamRecommendationsAnalyzer({
    workspaceId: workspace.id,
    customInstructions,
  });
}
