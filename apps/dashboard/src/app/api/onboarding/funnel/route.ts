import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { onboardingFunnelEvents } from "@sessionforge/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { step, event = "unknown", metadata } = body;

    if (!step) {
      return NextResponse.json(
        { error: "step is required" },
        { status: 400 }
      );
    }

    await db.insert(onboardingFunnelEvents).values({
      userId: session.user.id,
      step,
      event,
      metadata: metadata ?? null,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to record funnel event:", error);
    return NextResponse.json(
      { error: "Failed to record event" },
      { status: 500 }
    );
  }
}
