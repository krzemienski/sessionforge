/**
 * IP-based rate limiting for public (unauthenticated) endpoints.
 *
 * Uses the shared Redis client when available and falls back to an in-process
 * Map sized by the caller — the map is per-runtime so horizontal scaling
 * without Redis allows the effective burst rate to scale with instance count.
 * Production deployments should always configure Redis.
 *
 * Rate-limit identifier resolution picks the first of:
 *   1. `cf-connecting-ip` (Cloudflare)
 *   2. First entry of `x-forwarded-for`
 *   3. `x-real-ip`
 *   4. A constant fallback "anonymous" — DO NOT rely on this in production.
 *
 * The helper is bucketed by endpoint name (`bucket`) so different routes have
 * independent counters and one hot endpoint can't starve another.
 */

import { getRedis } from "@/lib/redis";

export interface RateLimitConfig {
  bucket: string;
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

const inMemoryBuckets = new Map<string, { count: number; resetAt: number }>();

function resolveClientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf;
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "anonymous";
}

export async function checkRateLimit(
  req: Request,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const ip = resolveClientIp(req);
  const key = `rl:${config.bucket}:${ip}`;
  const now = Date.now();

  const redis = await getRedis();
  if (redis) {
    const rawCount = await redis.get<number | string>(key);
    const current = rawCount === null ? 0 : Number(rawCount);

    if (Number.isFinite(current) && current >= config.limit) {
      return {
        ok: false,
        remaining: 0,
        retryAfterSeconds: config.windowSeconds,
      };
    }

    const next = (Number.isFinite(current) ? current : 0) + 1;
    await redis.set(key, next, { ex: config.windowSeconds });
    return {
      ok: true,
      remaining: Math.max(0, config.limit - next),
      retryAfterSeconds: 0,
    };
  }

  const entry = inMemoryBuckets.get(key);
  if (!entry || now >= entry.resetAt) {
    inMemoryBuckets.set(key, {
      count: 1,
      resetAt: now + config.windowSeconds * 1000,
    });
    if (inMemoryBuckets.size > 10_000) {
      for (const [k, v] of inMemoryBuckets) {
        if (now >= v.resetAt) inMemoryBuckets.delete(k);
      }
    }
    return { ok: true, remaining: config.limit - 1, retryAfterSeconds: 0 };
  }

  if (entry.count >= config.limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  entry.count += 1;
  return {
    ok: true,
    remaining: config.limit - entry.count,
    retryAfterSeconds: 0,
  };
}

export function rateLimitHeaders(result: RateLimitResult, config: RateLimitConfig): HeadersInit {
  const base: HeadersInit = {
    "X-RateLimit-Limit": String(config.limit),
    "X-RateLimit-Remaining": String(result.remaining),
  };
  if (!result.ok) {
    (base as Record<string, string>)["Retry-After"] = String(result.retryAfterSeconds);
  }
  return base;
}
