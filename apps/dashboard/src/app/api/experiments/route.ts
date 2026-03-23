import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  experiments,
  experimentVariants,
  workspaces,
} from "@sessionforge/db";
import { eq, desc, and } from "drizzle-orm/sql";
import { withApiHandler } from "@/lib/api-handler";
import { parseBody, experimentCreateSchema } from "@/lib/validation";
import { AppError, ERROR_CODES } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { searchParams } = new URL(request.url);
    const workspaceSlug = searchParams.get("workspace");
    const limit = parseInt(searchParams.get("limit") ?? "20", 10);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);
    const postId = searchParams.get("postId");
    const status = searchParams.get("status");

    if (!workspaceSlug) {
      throw new AppError(
        "workspace query param required",
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.slug, workspaceSlug),
    });

    if (!workspace || workspace.ownerId !== session.user.id) {
      throw new AppError("Workspace not found", ERROR_CODES.NOT_FOUND);
    }

    const conditions = [eq(experiments.workspaceId, workspace.id)];

    if (postId) {
      conditions.push(eq(experiments.postId, postId));
    }
    if (status) {
      conditions.push(
        eq(
          experiments.status,
          status as (typeof experiments.status.enumValues)[number]
        )
      );
    }

    const results = await db.query.experiments.findMany({
      where: and(...conditions),
      with: {
        variants: true,
      },
      orderBy: [desc(experiments.createdAt)],
      limit,
      offset,
    });

    return NextResponse.json({ experiments: results, limit, offset });
  })(request);
}

export async function POST(request: Request) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const rawBody = await request.json().catch(() => ({}));
    const {
      workspaceSlug,
      postId,
      name,
      kpi,
      startsAt,
      endsAt,
      variants,
    } = parseBody(experimentCreateSchema, rawBody);

    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.slug, workspaceSlug),
    });

    if (!workspace || workspace.ownerId !== session.user.id) {
      throw new AppError("Workspace not found", ERROR_CODES.NOT_FOUND);
    }

    // Validate that traffic allocations sum to 1.0
    const totalAllocation = variants.reduce(
      (sum, v) => sum + v.trafficAllocation,
      0
    );
    if (Math.abs(totalAllocation - 1.0) > 0.001) {
      throw new AppError(
        "Traffic allocations must sum to 1.0",
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Validate that at least one variant is the control
    const hasControl = variants.some((v) => v.isControl);
    if (!hasControl) {
      throw new AppError(
        "At least one variant must be marked as control (isControl: true)",
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Insert experiment
    const [experiment] = await db
      .insert(experiments)
      .values({
        workspaceId: workspace.id,
        postId,
        name,
        kpi,
        startsAt: startsAt ? new Date(startsAt) : undefined,
        endsAt: endsAt ? new Date(endsAt) : undefined,
      })
      .returning();

    // Insert all variants
    const insertedVariants = await db
      .insert(experimentVariants)
      .values(
        variants.map((v) => ({
          experimentId: experiment.id,
          label: v.label,
          headlineText: v.headlineText,
          hookText: v.hookText,
          trafficAllocation: v.trafficAllocation,
          isControl: v.isControl ?? false,
        }))
      )
      .returning();

    return NextResponse.json(
      { ...experiment, variants: insertedVariants },
      { status: 201 }
    );
  })(request);
}
