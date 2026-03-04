import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";
import { withApiHandler } from "@/lib/api-handler";
import { parseBody, workspaceCreateSchema } from "@/lib/validation";
import { AppError, ERROR_CODES } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const rows = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.ownerId, session.user.id));

    return NextResponse.json({ data: rows });
  })(req);
}

export async function POST(req: Request) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const rawBody = await req.json().catch(() => ({}));
    const { name, sessionBasePath } = parseBody(workspaceCreateSchema, rawBody);

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

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
