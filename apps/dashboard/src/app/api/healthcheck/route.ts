import { db } from "@/lib/db";
import { getRedis } from "@/lib/redis";
import { sql } from "drizzle-orm/sql";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  let dbOk = false;
  let redisOk = false;

  try {
    await db.execute(sql`SELECT 1`);
    dbOk = true;
  } catch (err) {
    console.error("[healthcheck] DB error:", err instanceof Error ? err.message : err);
  }

  const redis = await getRedis();
  if (redis) {
    try {
      await redis.ping();
      redisOk = true;
    } catch {
      // redis unreachable
    }
  }

  // When Redis is not configured (dev mode), don't mark as degraded
  const redisConfigured = !!process.env.UPSTASH_REDIS_URL || !!process.env.REDIS_URL;
  const status = dbOk ? (redisConfigured ? (redisOk ? "ok" : "degraded") : "ok") : "degraded";

  return NextResponse.json(
    {
      status,
      db: dbOk,
      redis: redisOk,
      timestamp: new Date().toISOString(),
    },
    { status: dbOk ? 200 : 503 }
  );
}
