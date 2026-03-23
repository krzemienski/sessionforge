import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { experiments } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";
import {
  determineWinner,
  type VariantResult,
  type ExperimentKpi,
} from "@/lib/experiments/statistics";

export const dynamic = "force-dynamic";

/**
 * Map a KPI name to the metric field used as "successes" and the field used
 * as "sample size" when building VariantResult objects from aggregated data.
 *
 * For count-based KPIs (views, likes, comments, shares) the metric value is
 * the total count and the sample size is total impressions.
 *
 * For engagementRate the metric value is the average rate multiplied by the
 * impression count so it can be treated as a proportion in the z-test.
 */
function aggregateVariantResult(
  variant: {
    id: string;
    label: string;
    isControl: boolean;
    results: Array<{
      impressions: number | null;
      clicks: number | null;
      views: number | null;
      likes: number | null;
      comments: number | null;
      shares: number | null;
      engagementRate: number | null;
    }>;
  },
  kpi: ExperimentKpi,
): VariantResult {
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
    },
  );

  const sampleSize = totals.impressions;

  let metricValue: number;
  switch (kpi) {
    case "views":
      metricValue = totals.views;
      break;
    case "likes":
      metricValue = totals.likes;
      break;
    case "comments":
      metricValue = totals.comments;
      break;
    case "shares":
      metricValue = totals.shares;
      break;
    case "engagement_rate": {
      // Average engagement rate × sample size to convert to a proportion-like
      // count for the z-test
      const avgRate =
        totals.count > 0 ? totals.totalEngagementRate / totals.count : 0;
      metricValue = avgRate * sampleSize;
      break;
    }
  }

  return {
    variantId: variant.id,
    label: variant.label,
    isControl: variant.isControl,
    sampleSize,
    metricValue,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
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
            results: true,
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

    const kpi = experiment.kpi as ExperimentKpi;

    // Build VariantResult objects from aggregated DB results
    const variantResults: VariantResult[] = experiment.variants.map((v) =>
      aggregateVariantResult({ ...v, isControl: v.isControl ?? false }, kpi),
    );

    // Run statistical analysis
    const winnerResult = determineWinner(variantResults);

    return NextResponse.json({
      winner: winnerResult.winnerId,
      confidence: winnerResult.confidence,
      pValue: winnerResult.pValue,
      variantStats: winnerResult.variantStats,
      minimumSampleReached: winnerResult.minimumSampleReached,
    });
  })(_request);
}
