import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiKeys, workspaces } from "@sessionforge/db";
import { eq } from "drizzle-orm";
import { createHash, randomBytes } from "crypto";
import { withApiHandler } from "@/lib/api-handler";
import { parseBody, apiKeyCreateSchema } from "@/lib/validation";
import { AppError, ERROR_CODES } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { searchParams } = new URL(req.url);
    const workspaceSlug = searchParams.get("workspace");

    if (!workspaceSlug) {
      throw new AppError("workspace query param required", ERROR_CODES.BAD_REQUEST);
    }

    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.slug, workspaceSlug),
    });

    if (!workspace || workspace.ownerId !== session.user.id) {
      throw new AppError("Workspace not found", ERROR_CODES.NOT_FOUND);
    }

    const keys = await db.query.apiKeys.findMany({
      where: eq(apiKeys.workspaceId, workspace.id),
      columns: {
        id: true,
        name: true,
        keyPrefix: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ keys });
  })(req);
}

export async function POST(req: Request) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const rawBody = await req.json().catch(() => ({}));
    const { workspaceSlug, name } = parseBody(apiKeyCreateSchema, rawBody);

    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.slug, workspaceSlug),
    });

    if (!workspace || workspace.ownerId !== session.user.id) {
      throw new AppError("Workspace not found", ERROR_CODES.NOT_FOUND);
    }

    const rawKey = `sf_live_${randomBytes(24).toString("hex")}`;
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const keyPrefix = rawKey.slice(0, 16);

    const [apiKey] = await db
      .insert(apiKeys)
      .values({
        workspaceId: workspace.id,
        name,
        keyHash,
        keyPrefix,
      })
      .returning();

    return NextResponse.json(
      { id: apiKey.id, name: apiKey.name, key: rawKey, keyPrefix },
      { status: 201 }
    );
  })(req);
}
