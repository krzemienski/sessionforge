import { NextResponse } from "next/server";
import { getPostAttribution } from "@/lib/attribution";

export const dynamic = "force-dynamic";

/**
 * GET /api/content/[id]/attribution
 *
 * Public endpoint returning anonymized session metadata for a post. No
 * authentication required — this is the verification URL embedded in the
 * "Forged by SessionForge" badge so readers can confirm authenticity without
 * needing an account.
 *
 * Privacy guarantee: only safe, aggregated fields are returned. File paths,
 * raw code, and session content are never exposed.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const attribution = await getPostAttribution(id);

  if (!attribution) {
    return NextResponse.json(
      { error: "Attribution data not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(attribution, {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
    },
  });
}
