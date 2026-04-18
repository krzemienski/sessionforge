# Upstash Redis Integration

> **Category:** External Interface
> **Service:** Upstash Redis / ioredis
> **Last Updated:** 2026-04-18
> **Status:** Active

## Overview

**Service:** Upstash Redis (HTTP-based) or ioredis (TCP-based)
**Provider:** Upstash / Self-hosted Redis
**Purpose:** Distributed caching and session storage
**Documentation:** https://upstash.com/docs/redis/overview

## Authentication

### Method

HTTP API Token (Upstash) or TCP connection (ioredis)

### Credentials Management

**Location:** Environment variables (production secrets)

**Upstash Configuration:**
```bash
UPSTASH_REDIS_URL=https://...upstash.io      # HTTP endpoint
UPSTASH_REDIS_TOKEN=...                       # Bearer token for auth
```

**Self-Hosted Configuration:**
```bash
REDIS_URL=redis://user:pass@host:6379        # TCP connection string
```

**Driver Selection (checked in order):**
1. `UPSTASH_REDIS_URL` + `UPSTASH_REDIS_TOKEN` → @upstash/redis (HTTP)
2. `REDIS_URL` → ioredis (TCP)
3. (neither) → Redis disabled (null)

### Lazy Initialization

```typescript
import { getRedis } from "@/lib/redis";

const redis = await getRedis();
if (!redis) {
  console.warn("Redis not configured");
}
```

## API Interface

### RedisClient Interface

All operations through a unified interface:

```typescript
interface RedisClient {
  ping(): Promise<string>;
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, opts?: { ex?: number }): Promise<unknown>;
  del(key: string): Promise<unknown>;
}
```

### Operations

**Ping (Health Check)**
```typescript
const pong = await redis.ping();
// Returns: "PONG"
```

**Get**
```typescript
const value = await redis.get<YourType>("key");
// Returns: deserialized object or null
// Automatically parses JSON
```

**Set (with optional TTL)**
```typescript
await redis.set("key", { data: "value" }, { ex: 3600 });
// TTL in seconds; ex: 3600 = 1 hour
```

**Delete**
```typescript
await redis.del("key");
// Returns: number of keys deleted
```

## Data Persistence

### Serialization

- **Upstash**: Automatically handles JSON serialization
- **ioredis**: Custom wrapper serializes values as JSON strings

### TTL (Time to Live)

```typescript
// Set with 1-hour expiration
await redis.set("session:abc123", sessionData, { ex: 3600 });

// No TTL (persistent)
await redis.set("config:theme", "dark");
```

## Error Handling

### Common Errors

**Error 1: Connection Failed**
- **Cause:** Redis host unreachable or invalid credentials
- **Recovery:** Check UPSTASH_REDIS_URL/TOKEN or REDIS_URL
- **Retry:** Automatic retry on next operation

**Error 2: Serialization Error**
- **Cause:** Value type not JSON-serializable
- **Recovery:** Ensure value is serializable (no circular refs, functions)
- **Retry:** No (data error)

**Error 3: Quota Exceeded**
- **Cause:** Upstash account storage quota exhausted
- **Recovery:** Upgrade account plan or delete old keys
- **Retry:** No (quota error)

### Graceful Degradation

If Redis unavailable, system continues without caching (slower, no TTL):

```typescript
const redis = await getRedis();
if (redis) {
  cached = await redis.get(key);
} else {
  // Fetch from DB directly
  cached = await fetchFromDb(key);
}
```

## Rate Limits

- **Upstash**: Depends on account tier (free: 10K commands/day)
- **ioredis**: No built-in rate limit (self-hosted)

**Handling Strategy:** Monitor command count; implement backoff if quota approaching.

## Use Cases

### Session Storage
```typescript
await redis.set(`session:${sessionId}`, sessionData, { ex: 86400 });
```

### Cache with TTL
```typescript
const cached = await redis.get<Article>(`article:${id}`);
if (!cached) {
  const data = await fetchArticle(id);
  await redis.set(`article:${id}`, data, { ex: 3600 });
}
```

### Rate Limiting
```typescript
const key = `ratelimit:${userId}`;
const count = await redis.get<number>(key) ?? 0;
if (count >= MAX_REQUESTS) {
  throw new Error("Rate limit exceeded");
}
await redis.set(key, count + 1, { ex: 60 });
```

## Testing

### Local Testing (No Real Redis)

```bash
# Using placeholders
export UPSTASH_REDIS_URL="https://placeholder.upstash.io"
export UPSTASH_REDIS_TOKEN="placeholder"
# getRedis() returns null; system falls back gracefully
```

### Integration Tests

```typescript
test("cache with TTL", async () => {
  const redis = await getRedis();
  if (!redis) skip();
  
  await redis.set("test:key", { data: 123 }, { ex: 10 });
  const result = await redis.get("test:key");
  
  expect(result).toEqual({ data: 123 });
});
```

## Monitoring

### Health Checks

**Endpoint:** Redis server (tested via ping())
**Frequency:** On connection, before cache operations

### Metrics to Track

- Ping success rate
- Cache hit rate
- Average get/set latency
- Memory usage (Upstash dashboard)
- Command count vs quota (Upstash)

### Alerts

- **Critical:** Connection failures (Redis unavailable)
- **Warning:** High latency (>100ms for get/set)
- **Warning:** Approaching quota (>80% of limit)

## Security Considerations

- API tokens stored as environment variables (never logged)
- No sensitive data stored without encryption consideration
- HTTP-based (Upstash) uses HTTPS transport
- TCP-based (ioredis) should use TLS in production

## Compliance

**Data Handling:**
- PII fields: Session tokens, user cache (encrypted by Redis)
- Retention: TTL-based auto-expiration
- Geographic restrictions: Upstash available globally; self-hosted depends on deployment

**Regulations:**
- GDPR: TTL ensures data deletion; Upstash compliant
- CCPA: User can request cache deletion (manual via CLI)

## Cost Considerations

**Upstash Pricing:** Free tier (10K commands/day), pay-as-you-go premium

**Cost Estimate:** 100K cache hits/day = ~$5/month (premium tier)

## Migration/Upgrade Path

**Current Version:** @upstash/redis 1.34 (HTTP) / ioredis 5 (TCP)

**Switching Drivers:** Change only env vars; code remains identical via RedisClient interface.

## Related Documentation

- [Patterns: Caching Strategy](../patterns/caching-strategy.md)
- [Interfaces: Upstash QStash](./upstash-qstash.md) — complementary Upstash service

## External Resources

- [Upstash Redis Docs](https://upstash.com/docs/redis/overview)
- [ioredis Documentation](https://github.com/luin/ioredis)
- [Redis Commands Reference](https://redis.io/commands)

## Version History

| Date | Change | Author |
|------|--------|--------|
| 2026-04-18 | Initial integration | capture-docs |
