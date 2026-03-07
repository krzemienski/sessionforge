/**
 * Programmatic branded hero/OG image generator.
 * Produces 1200x630 PNG via sharp SVG-to-PNG conversion.
 * No external APIs or API keys required.
 */

import sharp from "sharp";

const BRAND_GRADIENTS: Record<string, [string, string]> = {
  blog_post: ["#6366f1", "#8b5cf6"],
  twitter_thread: ["#0ea5e9", "#6366f1"],
  linkedin_post: ["#0077b5", "#00a0dc"],
  devto_post: ["#1e293b", "#475569"],
  changelog: ["#10b981", "#059669"],
  newsletter: ["#f59e0b", "#d97706"],
  custom: ["#6366f1", "#ec4899"],
};

const WIDTH = 1200;
const HEIGHT = 630;

function wrapTitle(title: string, maxCharsPerLine: number): string[] {
  const words = title.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (current.length + word.length + 1 > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
    if (lines.length >= 3) break;
  }
  if (current && lines.length < 3) lines.push(current);
  if (lines.length === 3 && current !== lines[2]) {
    lines[2] = lines[2].slice(0, maxCharsPerLine - 1) + "\u2026";
  }
  return lines;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatBadgeLabel(contentType: string): string {
  return contentType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function generateHeroImage(
  title: string,
  contentType: string,
): Promise<Buffer> {
  const [colorA, colorB] = BRAND_GRADIENTS[contentType] ?? BRAND_GRADIENTS.custom;
  const lines = wrapTitle(title, 35);
  const badgeLabel = formatBadgeLabel(contentType);

  const titleY = 260;
  const lineHeight = 64;

  const titleTspans = lines
    .map(
      (line, i) =>
        `<tspan x="80" dy="${i === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`,
    )
    .join("");

  const svg = `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${colorA}" />
      <stop offset="100%" stop-color="${colorB}" />
    </linearGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)" />

  <!-- Content type badge -->
  <rect x="80" y="60" width="${badgeLabel.length * 12 + 32}" height="36" rx="18" fill="rgba(255,255,255,0.2)" />
  <text x="96" y="84" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="600" fill="white">${escapeXml(badgeLabel)}</text>

  <!-- Title -->
  <text x="80" y="${titleY}" font-family="system-ui, -apple-system, sans-serif" font-size="52" font-weight="700" fill="white" letter-spacing="-0.02em">
    ${titleTspans}
  </text>

  <!-- Watermark -->
  <text x="${WIDTH - 80}" y="${HEIGHT - 40}" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="500" fill="rgba(255,255,255,0.5)" text-anchor="end">sessionforge</text>
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
