import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces, wordpressConnections } from "@sessionforge/db";
import { eq, and } from "drizzle-orm";
import { decryptAppPassword } from "@/lib/wordpress/crypto";
import { WordPressClient } from "@/lib/wordpress/client";

export const dynamic = "force-dynamic";

async function getWorkspaceId(
  session: Awaited<ReturnType<typeof auth.api.getSession>>,
  slug: string
): Promise<string | null> {
  const rows = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(
      and(
        eq(workspaces.ownerId, session!.user.id),
        eq(workspaces.slug, slug)
      )
    )
    .limit(1);

  return rows.length ? rows[0].id : null;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const wsId = await getWorkspaceId(session, slug);
  if (!wsId) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  // 1. Fetch stored connection
  const rows = await db
    .select({
      siteUrl: wordpressConnections.siteUrl,
      username: wordpressConnections.username,
      encryptedAppPassword: wordpressConnections.encryptedAppPassword,
    })
    .from(wordpressConnections)
    .where(
      and(
        eq(wordpressConnections.workspaceId, wsId),
        eq(wordpressConnections.isActive, true)
      )
    )
    .limit(1);

  if (!rows.length) {
    return NextResponse.json({
      success: false,
      error: "No WordPress connection configured",
    });
  }

  const { siteUrl, username, encryptedAppPassword } = rows[0];

  // 2. Decrypt app password — wrapped in try-catch to handle corrupted ciphertexts
  let appPassword: string;
  try {
    appPassword = decryptAppPassword(encryptedAppPassword);
  } catch {
    return NextResponse.json({
      success: false,
      error: "Failed to decrypt stored credentials",
    });
  }

  // 3. Instantiate client and run testConnection() + getCategories() + getTags() in parallel
  const client = new WordPressClient(siteUrl, username, appPassword);

  try {
    const [, categories, tags] = await Promise.all([
      client.testConnection(),
      client.getCategories(),
      client.getTags(),
    ]);

    // 4. Fetch the actual site title from the WP REST root endpoint (unauthenticated)
    let siteTitle = siteUrl;
    let wpVersion = "";
    try {
      const siteRoot = client.getApiBase().split("/wp-json")[0];
      const rootRes = await fetch(`${siteRoot}/wp-json/`, {
        headers: { Accept: "application/json" },
      });
      if (rootRes.ok) {
        const rootData = (await rootRes.json()) as {
          name?: string;
          description?: string;
        };
        if (rootData.name) siteTitle = rootData.name;
      }
    } catch {
      // Fall back to siteUrl if the root endpoint is inaccessible
    }

    // 5. Return success response
    return NextResponse.json({
      success: true,
      siteTitle,
      wpVersion,
      categories: categories.map(({ id, name }) => ({ id, name })),
      tags: tags.map(({ id, name }) => ({ id, name })),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Connection test failed";
    return NextResponse.json({ success: false, error: message });
  }
}
