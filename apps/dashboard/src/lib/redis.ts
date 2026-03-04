import type { Redis as RedisType } from "@upstash/redis";

let _redis: RedisType | null | undefined;

/**
 * Returns the Redis client, lazily initialized on first call.
 * Returns null when UPSTASH_REDIS_URL / UPSTASH_REDIS_TOKEN are not set.
 * Uses dynamic import to avoid module-level evaluation at build time.
 */
export async function getRedis(): Promise<RedisType | null> {
  if (_redis !== undefined) return _redis;

  const redisUrl = process.env.UPSTASH_REDIS_URL;
  const redisToken = process.env.UPSTASH_REDIS_TOKEN;

  if (
    !redisUrl ||
    !redisToken ||
    !redisUrl.startsWith("https://") ||
    redisToken === "placeholder"
  ) {
    console.warn(
      "[redis] UPSTASH_REDIS_URL or UPSTASH_REDIS_TOKEN not configured — Redis disabled"
    );
    _redis = null;
    return null;
  }

  const { Redis } = await import("@upstash/redis");
  _redis = new Redis({ url: redisUrl, token: redisToken });
  return _redis;
}
