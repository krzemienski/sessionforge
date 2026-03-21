import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces, writingStyleProfiles } from "@sessionforge/db";
import { eq, and } from "drizzle-orm/sql";
import { calibrateVoiceFromSamples } from "@/lib/ai/agents/voice-calibration-wizard";

export const dynamic = "force-dynamic";

const MIN_SAMPLES = 3;
const MAX_SAMPLES = 5;
const MIN_SAMPLE_LENGTH = 50;
const MAX_SAMPLE_LENGTH = 5000;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;

  const workspace = await db
    .select({ id: workspaces.id })
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

  const wsId = workspace[0].id;

  const body = await req.json().catch(() => ({}));
  const { samples } = body as { samples?: unknown };

  if (!Array.isArray(samples)) {
    return NextResponse.json(
      { error: "samples must be an array" },
      { status: 400 }
    );
  }

  if (samples.length < MIN_SAMPLES || samples.length > MAX_SAMPLES) {
    return NextResponse.json(
      { error: `Provide between ${MIN_SAMPLES} and ${MAX_SAMPLES} writing samples` },
      { status: 400 }
    );
  }

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    if (typeof sample !== "string") {
      return NextResponse.json(
        { error: `Sample ${i + 1} must be a string` },
        { status: 400 }
      );
    }
    if (sample.length < MIN_SAMPLE_LENGTH) {
      return NextResponse.json(
        { error: `Sample ${i + 1} must be at least ${MIN_SAMPLE_LENGTH} characters` },
        { status: 400 }
      );
    }
    if (sample.length > MAX_SAMPLE_LENGTH) {
      return NextResponse.json(
        { error: `Sample ${i + 1} must be at most ${MAX_SAMPLE_LENGTH} characters` },
        { status: 400 }
      );
    }
  }

  // Mark as generating before firing off the background job
  await db
    .insert(writingStyleProfiles)
    .values({ workspaceId: wsId, generationStatus: "generating" })
    .onConflictDoUpdate({
      target: writingStyleProfiles.workspaceId,
      set: { generationStatus: "generating", updatedAt: new Date() },
    });

  // Fire-and-forget: calibrateVoiceFromSamples handles its own DB upsert with 'completed' status
  calibrateVoiceFromSamples(wsId, samples as string[]).catch(() => {
    db.update(writingStyleProfiles)
      .set({ generationStatus: "failed", updatedAt: new Date() })
      .where(eq(writingStyleProfiles.workspaceId, wsId))
      .execute()
      .catch(() => undefined);
  });

  return NextResponse.json({ status: "generating" });
}
