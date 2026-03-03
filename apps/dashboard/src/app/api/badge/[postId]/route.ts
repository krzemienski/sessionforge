import { NextResponse } from "next/server";
import { getPostAttribution } from "@/lib/attribution";

export const dynamic = "force-dynamic";

/** Badge dimensions */
const BADGE_WIDTH = 240;
const BADGE_HEIGHT = 28;
/** Label section width (left green block) */
const LABEL_WIDTH = 168;

/**
 * Builds an SVG badge in the style of shields.io.
 * Left block: dark bg with "Forged by SessionForge" label.
 * Right block (only when score available): darker bg with the insight score.
 */
function buildBadgeSvg(scoreLabel: string | null): string {
  const totalWidth = scoreLabel ? BADGE_WIDTH : LABEL_WIDTH;
  const scoreWidth = BADGE_WIDTH - LABEL_WIDTH;

  const labelText = "Forged by SessionForge";
  const labelX = LABEL_WIDTH / 2;

  const scorePart = scoreLabel
    ? `
  <rect x="${LABEL_WIDTH}" width="${scoreWidth}" height="${BADGE_HEIGHT}" fill="#161b22"/>
  <text
    x="${LABEL_WIDTH + scoreWidth / 2}"
    y="14"
    dominant-baseline="middle"
    text-anchor="middle"
    font-family="DejaVu Sans,Verdana,Geneva,sans-serif"
    font-size="10"
    fill="#e6edf3"
  >${scoreLabel}</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${BADGE_HEIGHT}" role="img" aria-label="${labelText}">
  <title>${labelText}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#fff" stop-opacity=".15"/>
    <stop offset="1" stop-opacity=".15"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="${BADGE_HEIGHT}" rx="4" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${LABEL_WIDTH}" height="${BADGE_HEIGHT}" fill="#0d1117"/>
    <rect x="${LABEL_WIDTH - 1}" width="1" height="${BADGE_HEIGHT}" fill="#00d26a" opacity=".3"/>${scorePart}
    <rect width="${totalWidth}" height="${BADGE_HEIGHT}" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="10">
    <text x="${labelX}" y="14" dominant-baseline="middle" fill="#00d26a" font-weight="600">${labelText}</text>
  </g>
</svg>`;
}

/**
 * GET /api/badge/[postId]
 *
 * Returns an SVG badge image for the given post. Works as an embeddable image
 * in markdown (`![badge](/api/badge/postId)`) and HTML contexts.
 *
 * No authentication required — this is a public image URL.
 * Cached for 1 hour since badge content rarely changes.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;

  const attribution = await getPostAttribution(postId);

  const scoreLabel = attribution
    ? `${attribution.insightScore.toFixed(1)}/10`
    : null;

  const svg = buildBadgeSvg(scoreLabel);

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=300",
    },
  });
}
