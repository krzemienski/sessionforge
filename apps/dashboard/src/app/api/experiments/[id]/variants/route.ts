import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { experiments, experimentVariants } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";
import { withApiHandler } from "@/lib/api-handler";
import {
  parseBody,
  variantCreateSchema,
  variantUpdateSchema,
} from "@/lib/validation";
import { AppError, ERROR_CODES } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * Verify the experiment exists and the current user owns it.
 * Returns the experiment row (with workspace relation).
 */
async function verifyExperimentOwnership(
  experimentId: string,
  userId: string
) {
  const experiment = await db.query.experiments.findFirst({
    where: eq(experiments.id, experimentId),
    with: { workspace: true },
  });

  if (!experiment) {
    throw new AppError("Experiment not found", ERROR_CODES.NOT_FOUND);
  }

  if (experiment.workspace.ownerId !== userId) {
    throw new AppError("Forbidden", ERROR_CODES.FORBIDDEN);
  }

  return experiment;
}

// POST /api/experiments/[id]/variants — add a new variant
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { id: experimentId } = await params;
    await verifyExperimentOwnership(experimentId, session.user.id);

    const rawBody = await request.json().catch(() => ({}));
    const { label, headlineText, hookText, trafficAllocation, isControl } =
      parseBody(variantCreateSchema, rawBody);

    // Fetch existing variants to rebalance traffic allocations
    const existingVariants = await db.query.experimentVariants.findMany({
      where: eq(experimentVariants.experimentId, experimentId),
    });

    // Compute new allocations: scale existing down proportionally so total = 1.0
    const remainingAllocation = 1.0 - trafficAllocation;
    const existingTotal = existingVariants.reduce(
      (sum, v) => sum + v.trafficAllocation,
      0
    );

    // Rebalance existing variants
    for (const variant of existingVariants) {
      const newAllocation =
        existingTotal > 0
          ? (variant.trafficAllocation / existingTotal) * remainingAllocation
          : remainingAllocation / existingVariants.length;

      await db
        .update(experimentVariants)
        .set({
          trafficAllocation: Math.round(newAllocation * 10000) / 10000,
          updatedAt: new Date(),
        })
        .where(eq(experimentVariants.id, variant.id));
    }

    // Insert the new variant
    const [newVariant] = await db
      .insert(experimentVariants)
      .values({
        experimentId,
        label,
        headlineText,
        hookText,
        trafficAllocation,
        isControl: isControl ?? false,
      })
      .returning();

    // Return all variants after rebalancing
    const allVariants = await db.query.experimentVariants.findMany({
      where: eq(experimentVariants.experimentId, experimentId),
    });

    return NextResponse.json(
      { variant: newVariant, allVariants },
      { status: 201 }
    );
  })(request);
}

// PUT /api/experiments/[id]/variants — update a variant
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { id: experimentId } = await params;
    await verifyExperimentOwnership(experimentId, session.user.id);

    const rawBody = await request.json().catch(() => ({}));

    // variantId is required to identify which variant to update
    const variantId = rawBody.variantId;
    if (!variantId || typeof variantId !== "string") {
      throw new AppError(
        "variantId is required",
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    const updates = parseBody(variantUpdateSchema, rawBody);

    // Verify variant belongs to this experiment
    const variant = await db.query.experimentVariants.findFirst({
      where: eq(experimentVariants.id, variantId),
    });

    if (!variant || variant.experimentId !== experimentId) {
      throw new AppError("Variant not found", ERROR_CODES.NOT_FOUND);
    }

    // If trafficAllocation is being updated, validate total still sums to 1.0
    if (updates.trafficAllocation !== undefined) {
      const allVariants = await db.query.experimentVariants.findMany({
        where: eq(experimentVariants.experimentId, experimentId),
      });

      const totalAllocation = allVariants.reduce((sum, v) => {
        if (v.id === variantId) return sum + updates.trafficAllocation!;
        return sum + v.trafficAllocation;
      }, 0);

      if (Math.abs(totalAllocation - 1.0) > 0.001) {
        throw new AppError(
          "Traffic allocations must sum to 1.0",
          ERROR_CODES.VALIDATION_ERROR
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (updates.label !== undefined) updateData.label = updates.label;
    if (updates.headlineText !== undefined)
      updateData.headlineText = updates.headlineText;
    if (updates.hookText !== undefined) updateData.hookText = updates.hookText;
    if (updates.trafficAllocation !== undefined)
      updateData.trafficAllocation = updates.trafficAllocation;
    if (updates.isControl !== undefined)
      updateData.isControl = updates.isControl;
    updateData.updatedAt = new Date();

    const [updated] = await db
      .update(experimentVariants)
      .set(updateData)
      .where(eq(experimentVariants.id, variantId))
      .returning();

    return NextResponse.json(updated);
  })(request);
}

// DELETE /api/experiments/[id]/variants — remove a variant
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { id: experimentId } = await params;
    await verifyExperimentOwnership(experimentId, session.user.id);

    const { searchParams } = new URL(request.url);
    const variantId = searchParams.get("variantId");

    if (!variantId) {
      throw new AppError(
        "variantId query param required",
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Verify variant belongs to this experiment
    const variant = await db.query.experimentVariants.findFirst({
      where: eq(experimentVariants.id, variantId),
    });

    if (!variant || variant.experimentId !== experimentId) {
      throw new AppError("Variant not found", ERROR_CODES.NOT_FOUND);
    }

    // Must keep at least 2 variants
    const allVariants = await db.query.experimentVariants.findMany({
      where: eq(experimentVariants.experimentId, experimentId),
    });

    if (allVariants.length <= 2) {
      throw new AppError(
        "Cannot delete variant: experiment must have at least 2 variants",
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Delete the variant (cascades to results via FK constraint)
    await db
      .delete(experimentVariants)
      .where(eq(experimentVariants.id, variantId));

    // Rebalance remaining variants to sum to 1.0
    const remainingVariants = allVariants.filter((v) => v.id !== variantId);
    const currentTotal = remainingVariants.reduce(
      (sum, v) => sum + v.trafficAllocation,
      0
    );

    for (const rv of remainingVariants) {
      const newAllocation =
        currentTotal > 0
          ? rv.trafficAllocation / currentTotal
          : 1.0 / remainingVariants.length;

      await db
        .update(experimentVariants)
        .set({
          trafficAllocation: Math.round(newAllocation * 10000) / 10000,
          updatedAt: new Date(),
        })
        .where(eq(experimentVariants.id, rv.id));
    }

    // Return remaining variants after rebalancing
    const updatedVariants = await db.query.experimentVariants.findMany({
      where: eq(experimentVariants.experimentId, experimentId),
    });

    return NextResponse.json({ deleted: true, variants: updatedVariants });
  })(request);
}
