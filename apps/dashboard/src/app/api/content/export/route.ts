import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { posts, workspaces } from "@sessionforge/db";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { buildExportZip } from "@/lib/export/markdown-export";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { searchParams } = new URL(req.url);
    const workspaceSlug = searchParams.get("workspace");
    const contentType = searchParams.get("type");
    const status = searchParams.get("status");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    if (!workspaceSlug)
      throw new AppError("workspace query param required", ERROR_CODES.BAD_REQUEST);

    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.slug, workspaceSlug),
    });

    if (!workspace || workspace.ownerId !== session.user.id)
      throw new AppError("Workspace not found", ERROR_CODES.NOT_FOUND);

    const conditions = [eq(posts.workspaceId, workspace.id)];

    if (contentType) {
      conditions.push(
        eq(posts.contentType, contentType as typeof posts.contentType.enumValues[number])
      );
    }

    if (status) {
      conditions.push(
        eq(posts.status, status as typeof posts.status.enumValues[number])
      );
    }

    if (dateFrom) {
      conditions.push(gte(posts.createdAt, new Date(dateFrom)));
    }

    if (dateTo) {
      conditions.push(lte(posts.createdAt, new Date(dateTo)));
    }

    const results = await db.query.posts.findMany({
      where: and(...conditions),
      orderBy: [desc(posts.createdAt)],
    });

    // buildExportZip throws → withApiHandler catches → returns generic INTERNAL_ERROR (no leak)
    const zipBuffer = await buildExportZip(results);

    const filename = `sessionforge-export-${new Date().toISOString().slice(0, 10)}.zip`;

    return new Response(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(zipBuffer.length),
        "X-Export-Count": String(results.length),
      },
    });
  })(req);
}
