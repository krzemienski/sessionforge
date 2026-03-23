import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { experiments, experimentVariants, posts } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { id } = await params;

    // Fetch experiment with variants, workspace, and post
    const experiment = await db.query.experiments.findFirst({
      where: eq(experiments.id, id),
      with: {
        variants: true,
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

    // Only allow promoting from running or paused experiments
    if (experiment.status !== "running" && experiment.status !== "paused") {
      throw new AppError(
        "Can only promote a winner from experiments with status 'running' or 'paused'",
        ERROR_CODES.BAD_REQUEST
      );
    }

    const body = await request.json().catch(() => ({}));
    const { variantId } = body;

    if (!variantId || typeof variantId !== "string") {
      throw new AppError(
        "variantId is required",
        ERROR_CODES.BAD_REQUEST
      );
    }

    // Verify variant belongs to this experiment
    const variant = experiment.variants.find((v) => v.id === variantId);
    if (!variant) {
      throw new AppError(
        "Variant not found in this experiment",
        ERROR_CODES.NOT_FOUND
      );
    }

    // Mark the variant as winner
    await db
      .update(experimentVariants)
      .set({ isWinner: true, updatedAt: new Date() })
      .where(eq(experimentVariants.id, variantId));

    // Reset isWinner on other variants
    for (const v of experiment.variants) {
      if (v.id !== variantId && v.isWinner) {
        await db
          .update(experimentVariants)
          .set({ isWinner: false, updatedAt: new Date() })
          .where(eq(experimentVariants.id, v.id));
      }
    }

    // Update the parent post's title to the winning headline if headlineText is provided
    if (variant.headlineText) {
      await db
        .update(posts)
        .set({ title: variant.headlineText, updatedAt: new Date() })
        .where(eq(posts.id, experiment.postId));
    }

    // Mark experiment as completed
    const [updatedExperiment] = await db
      .update(experiments)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(experiments.id, id))
      .returning();

    // Fetch the updated post
    const updatedPost = await db.query.posts.findFirst({
      where: eq(posts.id, experiment.postId),
    });

    // Fetch updated experiment with all relations
    const fullExperiment = await db.query.experiments.findFirst({
      where: eq(experiments.id, id),
      with: {
        variants: true,
        workspace: true,
        post: true,
      },
    });

    return NextResponse.json({
      experiment: fullExperiment,
      post: updatedPost,
    });
  })(request);
}
