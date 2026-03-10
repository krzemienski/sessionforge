import { NextRequest, NextResponse } from "next/server";

/**
 * Redirect legacy routes to their canonical destinations.
 * Server-side 308 (permanent) redirects — no client-side flash.
 */

const REDIRECTS: Record<string, (ws: string) => string> = {
  series: (ws) => `/${ws}/content?filter=series`,
  collections: (ws) => `/${ws}/content?filter=collections`,
  recommendations: (ws) => `/${ws}/insights`,
};

const SETTINGS_REDIRECTS: Record<string, (ws: string) => string> = {
  style: (ws) => `/${ws}/settings?tab=style`,
  "api-keys": (ws) => `/${ws}/settings?tab=api-keys`,
  integrations: (ws) => `/${ws}/settings?tab=integrations`,
  webhooks: (ws) => `/${ws}/settings?tab=webhooks`,
  wordpress: (ws) => `/${ws}/settings?tab=integrations`,
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Match /:workspace/:route or /:workspace/settings/:sub
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 2) return NextResponse.next();

  const workspace = segments[0];

  // Never redirect API routes — /:workspace/ matchers can match /api/*
  if (workspace === "api" || workspace === "_next") return NextResponse.next();

  const route = segments[1];

  // Top-level redirects: /:ws/series, /:ws/collections, /:ws/recommendations
  if (segments.length === 2 && REDIRECTS[route]) {
    const url = request.nextUrl.clone();
    const dest = REDIRECTS[route](workspace);
    const [path, query] = dest.split("?");
    url.pathname = path;
    url.search = query ? `?${query}` : "";
    return NextResponse.redirect(url, 308);
  }

  // Settings sub-route redirects: /:ws/settings/:sub
  if (segments.length === 3 && route === "settings") {
    const sub = segments[2];
    if (SETTINGS_REDIRECTS[sub]) {
      const url = request.nextUrl.clone();
      const dest = SETTINGS_REDIRECTS[sub](workspace);
      const [path, query] = dest.split("?");
      url.pathname = path;
      url.search = query ? `?${query}` : "";
      return NextResponse.redirect(url, 308);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/:workspace/series",
    "/:workspace/collections",
    "/:workspace/recommendations",
    "/:workspace/settings/style",
    "/:workspace/settings/api-keys",
    "/:workspace/settings/integrations",
    "/:workspace/settings/webhooks",
    "/:workspace/settings/wordpress",
  ],
};
