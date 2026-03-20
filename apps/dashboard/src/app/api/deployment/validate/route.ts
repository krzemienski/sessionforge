import { db } from "@/lib/db";
import { getRedis } from "@/lib/redis";
import { sql } from "drizzle-orm/sql";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type EnvVarStatus = { present: boolean; value?: string };

function detectDeploymentMode(): "neon-managed" | "self-hosted" | "vercel" {
  const isVercel = !!process.env.VERCEL;
  const databaseUrl = process.env.DATABASE_URL ?? "";
  const isNeon =
    databaseUrl.includes("neon.tech") ||
    databaseUrl.includes("neon.database") ||
    !!process.env.DATABASE_URL_UNPOOLED;

  if (isVercel && isNeon) return "neon-managed";
  if (isVercel) return "vercel";
  return "self-hosted";
}

export async function GET(req: NextRequest) {
  // Auth: if DEPLOYMENT_VALIDATE_TOKEN is set, require it in the Authorization header
  const validateToken = process.env.DEPLOYMENT_VALIDATE_TOKEN;
  if (validateToken) {
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : authHeader;
    if (token !== validateToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // --- Required env vars ---
  const requiredVars: Record<string, EnvVarStatus> = {
    DATABASE_URL: { present: !!process.env.DATABASE_URL },
    BETTER_AUTH_SECRET: { present: !!process.env.BETTER_AUTH_SECRET },
    NEXT_PUBLIC_APP_URL: { present: !!process.env.NEXT_PUBLIC_APP_URL },
  };

  const requiredOk = Object.values(requiredVars).every((v) => v.present);

  // --- Optional env vars ---
  const optionalVars: Record<string, EnvVarStatus> = {
    // Redis (Upstash or standard)
    UPSTASH_REDIS_URL: { present: !!process.env.UPSTASH_REDIS_URL },
    UPSTASH_REDIS_TOKEN: { present: !!process.env.UPSTASH_REDIS_TOKEN },
    REDIS_URL: { present: !!process.env.REDIS_URL },
    // Queue
    QUEUE_URL: { present: !!process.env.QUEUE_URL },
    // OAuth
    GITHUB_CLIENT_ID: { present: !!process.env.GITHUB_CLIENT_ID },
    GITHUB_CLIENT_SECRET: { present: !!process.env.GITHUB_CLIENT_SECRET },
    GOOGLE_CLIENT_ID: { present: !!process.env.GOOGLE_CLIENT_ID },
    GOOGLE_CLIENT_SECRET: { present: !!process.env.GOOGLE_CLIENT_SECRET },
    // Stripe
    STRIPE_SECRET_KEY: { present: !!process.env.STRIPE_SECRET_KEY },
    STRIPE_WEBHOOK_SECRET: { present: !!process.env.STRIPE_WEBHOOK_SECRET },
  };

  // --- Database connectivity ---
  let dbOk = false;
  let dbError: string | undefined;
  try {
    await db.execute(sql`SELECT 1`);
    dbOk = true;
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  // --- Redis connectivity ---
  const redisConfigured =
    !!(process.env.UPSTASH_REDIS_URL && process.env.UPSTASH_REDIS_TOKEN) ||
    !!process.env.REDIS_URL;
  let redisOk = false;
  let redisError: string | undefined;
  if (redisConfigured) {
    const redis = await getRedis();
    if (redis) {
      try {
        await redis.ping();
        redisOk = true;
      } catch (err) {
        redisError = err instanceof Error ? err.message : String(err);
      }
    }
  }

  // --- Deployment mode ---
  const mode = detectDeploymentMode();

  // --- Overall status ---
  const allOk = requiredOk && dbOk;

  return NextResponse.json(
    {
      status: allOk ? "ok" : "degraded",
      mode,
      checks: {
        required: requiredVars,
        optional: optionalVars,
        db: {
          ok: dbOk,
          ...(dbError ? { error: dbError } : {}),
        },
        redis: {
          configured: redisConfigured,
          ok: redisOk,
          ...(redisError ? { error: redisError } : {}),
        },
      },
      timestamp: new Date().toISOString(),
    },
    { status: allOk ? 200 : 503 }
  );
}
