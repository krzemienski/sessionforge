import { NextResponse } from "next/server";
import { getPostAttribution } from "@/lib/attribution";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const RATE_LIMIT = {
  bucket: "attribution",
  limit: 60,
  windowSeconds: 60,
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const limit = await checkRateLimit(request, RATE_LIMIT);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: rateLimitHeaders(limit, RATE_LIMIT) },
    );
  }

  const { id } = await params;

  const attribution = await getPostAttribution(id);

  if (!attribution) {
    return NextResponse.json(
      { error: "Attribution data not found" },
      { status: 404, headers: rateLimitHeaders(limit, RATE_LIMIT) },
    );
  }

  return NextResponse.json(attribution, {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
      ...rateLimitHeaders(limit, RATE_LIMIT),
    },
  });
}
