import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { experiments, experimentResults, experimentVariants } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";
import { withApiHandler } from "@/lib/api-handler";
import { parseBody, resultRecordSchema } from "@/lib/validation";
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
        workspace: true,
        variants: {
          with: {
            results: {
              orderBy: (results, { asc }) => [asc(results.recordedAt)],
            },
          },
        },
      },
    });

    if (!experiment) {
      throw new AppError("Experiment not found", ERROR_CODES.NOT_FOUND);
    }

    if (experiment.workspace.ownerId !== session.user.id) {
      throw new AppError("Forbidden", ERROR_CODES.FORBIDDEN);
    }

    // Group results by variant with totals
    const variantResults = experiment.variants.map((variant) => {
      const totals = variant.results.reduce(
        (acc, r) => ({
          impressions: acc.impressions + (r.impressions ?? 0),
          clicks: acc.clicks + (r.clicks ?? 0),
          views: acc.views + (r.views ?? 0),
          likes: acc.likes + (r.likes ?? 0),
          comments: acc.comments + (r.comments ?? 0),
          shares: acc.shares + (r.shares ?? 0),
          totalEngagementRate: acc.totalEngagementRate + (r.engagementRate ?? 0),
          count: acc.count + 1,
        }),
        {
          impressions: 0,
          clicks: 0,
          views: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          totalEngagementRate: 0,
          count: 0,
        }
      );

      return {
        variantId: variant.id,
        label: variant.label,
        isControl: variant.isControl,
        isWinner: variant.isWinner,
        totals: {
          impressions: totals.impressions,
          clicks: totals.clicks,
          views: totals.views,
          likes: totals.likes,
          comments: totals.comments,
          shares: totals.shares,
          avgEngagementRate:
            totals.count > 0
              ? totals.totalEngagementRate / totals.count
              : 0,
        },
        timeSeries: variant.results.map((r) => ({
          id: r.id,
          impressions: r.impressions,
          clicks: r.clicks,
          views: r.views,
          likes: r.likes,
          comments: r.comments,
          shares: r.shares,
          engagementRate: r.engagementRate,
          recordedAt: r.recordedAt,
        })),
      };
    });

    return NextResponse.json({
      experimentId: experiment.id,
      name: experiment.name,
      kpi: experiment.kpi,
      status: experiment.status,
      variants: variantResults,
    });
  })(_request);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const { id } = await params;

    // Verify experiment exists and user owns it
    const experiment = await db.query.experiments.findFirst({
      where: eq(experiments.id, id),
      with: { workspace: true },
    });

    if (!experiment) {
      throw new AppError("Experiment not found", ERROR_CODES.NOT_FOUND);
    }

    if (experiment.workspace.ownerId !== session.user.id) {
      throw new AppError("Forbidden", ERROR_CODES.FORBIDDEN);
    }

    const rawBody = await request.json().catch(() => ({}));
    const data = parseBody(resultRecordSchema, rawBody);

    // Verify the variant belongs to this experiment
    const variant = await db.query.experimentVariants.findFirst({
      where: eq(experimentVariants.id, data.variantId),
    });

    if (!variant || variant.experimentId !== id) {
      throw new AppError(
        "Variant not found in this experiment",
        ERROR_CODES.NOT_FOUND
      );
    }

    const [result] = await db
      .insert(experimentResults)
      .values({
        variantId: data.variantId,
        impressions: data.impressions ?? 0,
        clicks: data.clicks ?? 0,
        views: data.views ?? 0,
        likes: data.likes ?? 0,
        comments: data.comments ?? 0,
        shares: data.shares ?? 0,
        engagementRate: data.engagementRate ?? 0,
        recordedAt: new Date(),
      })
      .returning();

    return NextResponse.json(result, { status: 201 });
  })(request);
}
