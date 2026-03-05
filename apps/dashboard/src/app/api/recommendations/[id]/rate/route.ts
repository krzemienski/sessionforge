import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentRecommendations } from "@sessionforge/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const existing = await db.query.contentRecommendations.findFirst({
    where: eq(contentRecommendations.id, id),
    with: { workspace: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Recommendation not found" }, { status: 404 });
  }

  if (existing.workspace.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { helpful } = body;

  if (typeof helpful !== "boolean") {
    return NextResponse.json({ error: "helpful must be a boolean" }, { status: 400 });
  }

  try {
    const [updated] = await db
      .update(contentRecommendations)
      .set({ helpfulRating: helpful })
      .where(eq(contentRecommendations.id, id))
      .returning();

    return NextResponse.json({ rated: true, helpfulRating: updated.helpfulRating });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Rating failed" },
      { status: 500 }
    );
  }
}
