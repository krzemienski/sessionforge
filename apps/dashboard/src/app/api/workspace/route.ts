import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces, workspaceMembers } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";
import { withApiHandler } from "@/lib/api-handler";
import { parseBody, workspaceCreateSchema } from "@/lib/validation";
import { AppError, ERROR_CODES } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    // Return workspaces where user is owner OR a member
    const ownedRows = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.ownerId, session.user.id));

    const memberRows = await db
      .select({ workspace: workspaces })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(eq(workspaceMembers.userId, session.user.id));

    // Deduplicate by workspace id (owner may also be a member)
    const seen = new Set(ownedRows.map((w) => w.id));
    const memberWorkspaces = memberRows
      .map((r) => r.workspace)
      .filter((w) => !seen.has(w.id));

    const rows = [...ownedRows, ...memberWorkspaces];

    return NextResponse.json({ data: rows });
  })(req);
}

export async function POST(req: Request) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const rawBody = await req.json().catch(() => ({}));
    const { name, sessionBasePath } = parseBody(workspaceCreateSchema, rawBody);

    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Check for slug collision and append suffix if needed
    let slug = baseSlug;
    let suffix = 2;
    while (true) {
      const existing = await db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(eq(workspaces.slug, slug))
        .limit(1);
      if (existing.length === 0) break;
      slug = `${baseSlug}-${suffix}`;
      suffix++;
    }

    const [created] = await db
      .insert(workspaces)
      .values({
        name,
        slug,
        ownerId: session.user.id,
        sessionBasePath: sessionBasePath ?? "~/.claude",
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  })(req);
}
