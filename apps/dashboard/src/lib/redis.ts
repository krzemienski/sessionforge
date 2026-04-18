/**
 * Thin Redis client wrapper supporting both Upstash and standard Redis (ioredis).
 *
 * Driver selection (checked in order):
 *   1. UPSTASH_REDIS_URL + UPSTASH_REDIS_TOKEN → @upstash/redis
 *   2. REDIS_URL                                → ioredis
 *   3. (neither)                                → null (disabled)
 */

/**
 * Unified Redis client interface supporting both Upstash and ioredis.
 * Abstracts the underlying driver (HTTP vs TCP) with a consistent API.
 */
export interface RedisClient {
  /** Ping the Redis server. */
  ping(): Promise<string>;
  /** Get a value by key. Returns null if key doesn't exist. */
  get<T>(key: string): Promise<T | null>;
  /** Set a key-value pair with optional expiration in seconds. */
  set(key: string, value: unknown, opts?: { ex?: number }): Promise<unknown>;
  /** Delete a key. */
  del(key: string): Promise<unknown>;
}

let _redis: RedisClient | null | undefined;

/**
 * Returns the Redis client, lazily initialized on first call.
 * Returns null when no Redis environment variables are configured.
 * Uses dynamic import to avoid module-level evaluation at build time.
 */
export async function getRedis(): Promise<RedisClient | null> {
  if (_redis !== undefined) return _redis;

  // --- Upstash Redis (HTTP-based, works in edge/serverless) ---
  const upstashUrl = process.env.UPSTASH_REDIS_URL;
  const upstashToken = process.env.UPSTASH_REDIS_TOKEN;

  if (
    upstashUrl &&
    upstashToken &&
    upstashUrl.startsWith("https://") &&
    upstashToken !== "placeholder"
  ) {
    const { Redis } = await import("@upstash/redis");
    const client = new Redis({ url: upstashUrl, token: upstashToken });
    // Upstash Redis is already compatible with RedisClient interface
    _redis = client as unknown as RedisClient;
    return _redis;
  }

  // --- Standard Redis via ioredis (TCP, self-hosted / BYO infra) ---
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    const { default: IORedis } = await import("ioredis");
    const ioredis = new IORedis(redisUrl, { lazyConnect: true });

    _redis = {
      async ping(): Promise<string> {
        return ioredis.ping();
      },

      async get<T>(key: string): Promise<T | null> {
        const raw = await ioredis.get(key);
        if (raw === null) return null;
        try {
          return JSON.parse(raw) as T;
        } catch {
          return raw as unknown as T;
        }
      },

      async set(
        key: string,
        value: unknown,
        opts?: { ex?: number }
      ): Promise<unknown> {
        const serialized =
          typeof value === "string" ? value : JSON.stringify(value);
        if (opts?.ex) {
          return ioredis.set(key, serialized, "EX", opts.ex);
        }
        return ioredis.set(key, serialized);
      },

      async del(key: string): Promise<unknown> {
        return ioredis.del(key);
      },
    };

    return _redis;
  }

  // --- Disabled ---
  console.warn(
    "[redis] No Redis configuration found (UPSTASH_REDIS_URL or REDIS_URL) — Redis disabled"
  );
  _redis = null;
  return null;
}
