import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { experiments } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";
import { withApiHandler } from "@/lib/api-handler";
import { parseBody, experimentUpdateSchema } from "@/lib/validation";
import { AppError, ERROR_CODES } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { id } = await params;

    const experiment = await db.query.experiments.findFirst({
      where: eq(experiments.id, id),
      with: {
        variants: {
          with: {
            results: true,
          },
        },
        workspace: true,
        post: true,
      },
    });

    if (!experiment) {
      throw new AppError("Experiment not found", ERROR_CODES.NOT_FOUND);
    }

    if (experiment.workspace.ownerId !== session.user.id) {
      throw new AppError("Forbidden", ERROR_CODES.FORBIDDEN);
    }

    return NextResponse.json(experiment);
  })(_request);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { id } = await params;

    // Verify ownership
    const existing = await db.query.experiments.findFirst({
      where: eq(experiments.id, id),
      with: { workspace: true },
    });

    if (!existing) {
      throw new AppError("Experiment not found", ERROR_CODES.NOT_FOUND);
    }

    if (existing.workspace.ownerId !== session.user.id) {
      throw new AppError("Forbidden", ERROR_CODES.FORBIDDEN);
    }

    const rawBody = await request.json().catch(() => ({}));
    const { name, kpi, status, startsAt, endsAt } = parseBody(
      experimentUpdateSchema,
      rawBody
    );

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (kpi !== undefined) updateData.kpi = kpi;
    if (status !== undefined) updateData.status = status;
    if (startsAt !== undefined)
      updateData.startsAt = startsAt ? new Date(startsAt) : null;
    if (endsAt !== undefined)
      updateData.endsAt = endsAt ? new Date(endsAt) : null;
    updateData.updatedAt = new Date();

    const [updated] = await db
      .update(experiments)
      .set(updateData)
      .where(eq(experiments.id, id))
      .returning();

    return NextResponse.json(updated);
  })(request);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { id } = await params;

    const existing = await db.query.experiments.findFirst({
      where: eq(experiments.id, id),
      with: { workspace: true },
    });

    if (!existing) {
      throw new AppError("Experiment not found", ERROR_CODES.NOT_FOUND);
    }

    if (existing.workspace.ownerId !== session.user.id) {
      throw new AppError("Forbidden", ERROR_CODES.FORBIDDEN);
    }

    // Cascade: delete results -> variants -> experiment
    // Schema has onDelete: "cascade" on FK constraints, so deleting
    // the experiment will cascade to variants and their results.
    await db.delete(experiments).where(eq(experiments.id, id));

    return NextResponse.json({ deleted: true });
  })(_request);
}
