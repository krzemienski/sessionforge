# ADR 006: Redis Dual-Client Auto-Selection (Upstash + ioredis)

**Date:** 2026-04-18
**Status:** Accepted
**Deciders:** Nick (Engineering Lead)

---

## Context

SessionForge uses Redis for two purposes:

1. **Scan result caching** — Speed up repeated session scans within a 24-hour window
2. **Rate limiting** — Prevent abuse of content-generation and publishing endpoints

Redis deployment varies by environment:

- **Local dev:** Self-hosted Redis via Docker or Homebrew
- **Vercel/production:** Upstash Redis (HTTP-based, serverless-compatible)

The app needed a single Redis interface that **auto-selects** the right driver based on environment variables, with fallback to no-op (disabled) when neither is configured.

---

## Decision

**Implement a dual-client wrapper that auto-selects between Upstash (HTTP) and ioredis (TCP).**

### Implementation

**File:** `apps/dashboard/src/lib/redis.ts`

```typescript
export interface RedisClient {
  ping(): Promise<string>;
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, opts?: { ex?: number }): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

export async function getRedis(): Promise<RedisClient | null> {
  // 1. Check Upstash (HTTP-based, works in Vercel Edge Functions)
  if (UPSTASH_REDIS_URL && UPSTASH_REDIS_TOKEN) {
    const { Redis } = await import("@upstash/redis");
    return new Redis({ url: UPSTASH_REDIS_URL, token: UPSTASH_REDIS_TOKEN });
  }

  // 2. Check ioredis (TCP, self-hosted / BYO infra)
  if (REDIS_URL) {
    const { default: IORedis } = await import("ioredis");
    return new IORedis(REDIS_URL, { lazyConnect: true });
  }

  // 3. Disabled (no Redis)
  console.warn("[redis] No Redis configured — caching disabled");
  return null;
}
```

### Environment Variables

| Env Var | Driver | Usage | Example |
|---------|--------|-------|---------|
| `UPSTASH_REDIS_URL` | Upstash | Base URL | `https://falling-kitten-12345.upstash.io` |
| `UPSTASH_REDIS_TOKEN` | Upstash | Auth token | (secret) |
| `REDIS_URL` | ioredis | Connection string | `redis://localhost:6379` |
| (none) | None | Disabled | (not set) |

**Selection order (checked in sequence):**
1. Upstash (if both env vars present and not placeholder)
2. ioredis (if `REDIS_URL` present)
3. Disabled (fallback; caching unavailable)

---

## Consequences

### Positive
- **Environment-aware:** Same code runs in dev (ioredis) and production (Upstash) without conditional imports
- **Serverless-compatible:** Upstash's HTTP driver works in Vercel Edge Functions (no persistent TCP connections needed)
- **Graceful degradation:** If Redis is unavailable, app continues (caching is best-effort, not critical)
- **Single interface:** Callers use `getRedis()` without knowing which driver is active

### Negative
- **Dynamic imports:** `await import()` happens at runtime, not at build time; adds latency to first `getRedis()` call
- **Dual-dependency:** Both `@upstash/redis` and `ioredis` must be installed even if only one is used
- **Environment coupling:** Code behavior depends on env vars; wrong config silently disables caching

### Neutral
- **Lazy initialization:** `_redis` is cached after first call; subsequent calls return cached instance
- **No connection pooling:** ioredis pool is not shared across requests; each worker has its own instance

---

## Alternatives Considered

1. **Upstash only (no ioredis fallback)**
   - Rationale: Simplifies dependencies; Upstash works everywhere
   - Trade-off: Costs money even in local dev; requires internet access for every cache hit
   - Rejected: Local dev should not depend on external services

2. **ioredis only (no Upstash)**
   - Rationale: Simpler; one driver
   - Trade-off: Requires persistent TCP connections in Vercel Edge Functions (not supported; connection pools are not available in Vercel)
   - Rejected: ioredis does not work in edge runtime

3. **Memcached instead of Redis**
   - Rationale: Simpler semantics; no persistence overhead
   - Trade-off: No TTL/expiry support; requires manual key cleanup
   - Rejected: Redis's TTL and atomic operations are needed for rate limiting

4. **No caching (disable Redis entirely)**
   - Rationale: Reduces complexity; no dependency on external cache
   - Trade-off: Scan results re-computed every time; content generation may be rate-limited more aggressively
   - Rejected: Caching significantly improves UX for repeated operations

---

## Configuration

### Local Development

```bash
# Option A: Use Upstash (cloud)
export UPSTASH_REDIS_URL="https://falling-kitten-12345.upstash.io"
export UPSTASH_REDIS_TOKEN="secret_token"

# Option B: Use local ioredis
export REDIS_URL="redis://localhost:6379"
docker run -d -p 6379:6379 redis

# Option C: Disabled (no caching)
# (unset both env vars)
```

### Vercel Production

```bash
# Use Upstash (configured via Vercel Environment Variables)
UPSTASH_REDIS_URL=https://falling-kitten-12345.upstash.io
UPSTASH_REDIS_TOKEN=(secret token)
```

---

## References

- `apps/dashboard/src/lib/redis.ts` — dual-client wrapper implementation
- `apps/dashboard/package.json` — dependencies: `@upstash/redis`, `ioredis`
- `.env.example` — sample env var documentation

---
