/**
 * Integration tests for the retry-publisher module.
 *
 * Exercises retry logic, idempotency key generation, error classification,
 * and duplicate detection. Mocks the database and event bus at their
 * boundaries.
 */

import { describe, it, expect, mock, beforeEach } from "bun:test";

// ---------------------------------------------------------------------------
// Mock state
// ---------------------------------------------------------------------------

const mockFindFirst = mock(async () => null as { devtoUrl?: string } | null);
const mockEventBusEmit = mock(() => {});

// ---------------------------------------------------------------------------
// Module mocks (must be registered before imports)
// ---------------------------------------------------------------------------

mock.module("@/lib/db", () => ({
  db: {
    query: {
      devtoPublications: { findFirst: mockFindFirst },
    },
  },
}));

mock.module("@sessionforge/db", () => ({
  devtoPublications: { postId: "postId" },
  ghostPublications: {},
  mediumPublications: {},
  twitterPublications: {},
  linkedinPublications: {},
  devtoIntegrations: { workspaceId: "workspaceId", enabled: "enabled", healthStatus: "healthStatus" },
  ghostIntegrations: { workspaceId: "workspaceId", enabled: "enabled", healthStatus: "healthStatus" },
  mediumIntegrations: { workspaceId: "workspaceId", enabled: "enabled", healthStatus: "healthStatus" },
  twitterIntegrations: { workspaceId: "workspaceId", enabled: "enabled", healthStatus: "healthStatus" },
  linkedinIntegrations: { workspaceId: "workspaceId", enabled: "enabled", healthStatus: "healthStatus" },
  wordpressConnections: { workspaceId: "workspaceId", isActive: "isActive", healthStatus: "healthStatus" },
  integrationHealthChecks: { id: "id", workspaceId: "workspaceId", platform: "platform" },
}));

mock.module("drizzle-orm", () => ({
  eq: mock(() => null),
  and: mock(() => null),
}));

mock.module("@/lib/observability/event-bus", () => ({
  eventBus: { emit: mockEventBusEmit },
}));

mock.module("@/lib/observability/event-types", () => ({
  createAgentEvent: mock(
    (_traceId: string, _wsId: string, _agent: string, type: string, data: unknown) => ({
      type,
      data,
    })
  ),
}));

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------

const { publishWithRetry, generateIdempotencyKey } = await import(
  "../../src/lib/integrations/retry-publisher"
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePublishError(status: number, message: string): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("retry-publisher", () => {
  beforeEach(() => {
    mockFindFirst.mockReset();
    mockEventBusEmit.mockReset();
    mockFindFirst.mockImplementation(async () => null);
  });

  // -------------------------------------------------------------------------
  // Idempotency key generation
  // -------------------------------------------------------------------------

  describe("generateIdempotencyKey", () => {
    it("returns a deterministic SHA-256 hex string", () => {
      const key1 = generateIdempotencyKey("post-1", "devto");
      const key2 = generateIdempotencyKey("post-1", "devto");
      expect(key1).toBe(key2);
      expect(key1).toMatch(/^[0-9a-f]{64}$/);
    });

    it("produces different keys for different post + platform combos", () => {
      const key1 = generateIdempotencyKey("post-1", "devto");
      const key2 = generateIdempotencyKey("post-1", "medium");
      const key3 = generateIdempotencyKey("post-2", "devto");
      expect(key1).not.toBe(key2);
      expect(key1).not.toBe(key3);
    });
  });

  // -------------------------------------------------------------------------
  // Successful publish
  // -------------------------------------------------------------------------

  describe("successful publish", () => {
    it("returns the publish result on first attempt", async () => {
      const publishFn = mock(async () => ({
        platform: "devto" as const,
        success: true,
        url: "https://dev.to/user/post",
      }));

      const result = await publishWithRetry({
        publishFn,
        platform: "devto",
        postId: "post-1",
      });

      expect(result.result.success).toBe(true);
      expect(result.result.url).toBe("https://dev.to/user/post");
      expect(result.attempts).toBe(1);
      expect(result.idempotencyKey).toMatch(/^[0-9a-f]{64}$/);
      expect(publishFn).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Duplicate detection (idempotency)
  // -------------------------------------------------------------------------

  describe("duplicate detection", () => {
    it("returns skipped result when publication already exists", async () => {
      mockFindFirst.mockImplementation(async () => ({
        devtoUrl: "https://dev.to/user/existing-post",
      }));

      const publishFn = mock(async () => ({
        platform: "devto" as const,
        success: true,
        url: "https://dev.to/user/new-post",
      }));

      const result = await publishWithRetry({
        publishFn,
        platform: "devto",
        postId: "post-1",
      });

      expect(result.result.success).toBe(true);
      expect(result.result.skipped).toBe(true);
      expect(result.result.url).toBe("https://dev.to/user/existing-post");
      expect(publishFn).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Auth error handling (401/403 → no retry)
  // -------------------------------------------------------------------------

  describe("auth error handling", () => {
    it("returns immediately on 401 error without retrying", async () => {
      const publishFn = mock(async () => {
        throw makePublishError(401, "Unauthorized - API key expired");
      });

      const result = await publishWithRetry({
        publishFn,
        platform: "devto",
        postId: "post-1",
        workspaceId: "ws-1",
      });

      expect(result.result.success).toBe(false);
      expect(result.result.error).toContain("Unauthorized");
      expect(result.attempts).toBe(1);
      expect(publishFn).toHaveBeenCalledTimes(1);
    });

    it("returns immediately on 403 error without retrying", async () => {
      const publishFn = mock(async () => {
        throw makePublishError(403, "Forbidden");
      });

      const result = await publishWithRetry({
        publishFn,
        platform: "twitter",
        postId: "post-2",
      });

      expect(result.result.success).toBe(false);
      expect(result.attempts).toBe(1);
      expect(publishFn).toHaveBeenCalledTimes(1);
    });

    it("emits auth_expired event on auth errors when workspaceId provided", async () => {
      const publishFn = mock(async () => {
        throw makePublishError(401, "Token expired");
      });

      await publishWithRetry({
        publishFn,
        platform: "devto",
        postId: "post-1",
        workspaceId: "ws-1",
      });

      expect(mockEventBusEmit).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Validation error handling (422 → no retry)
  // -------------------------------------------------------------------------

  describe("validation error handling", () => {
    it("returns permanent failure on 422 without retrying", async () => {
      const publishFn = mock(async () => {
        throw makePublishError(422, "Invalid article format");
      });

      const result = await publishWithRetry({
        publishFn,
        platform: "devto",
        postId: "post-1",
      });

      expect(result.result.success).toBe(false);
      expect(result.result.error).toContain("Invalid article format");
      expect(result.attempts).toBe(1);
      expect(publishFn).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Transient error retry with backoff
  // -------------------------------------------------------------------------

  describe("transient error retry", () => {
    it("retries 5xx errors with backoff and eventually succeeds", async () => {
      let callCount = 0;
      const publishFn = mock(async () => {
        callCount++;
        if (callCount < 3) {
          throw makePublishError(500, "Internal Server Error");
        }
        return {
          platform: "devto" as const,
          success: true,
          url: "https://dev.to/user/post",
        };
      });

      const result = await publishWithRetry({
        publishFn,
        platform: "devto",
        postId: "post-1",
        workspaceId: "ws-1",
        delays: [10, 10, 10], // Use very short delays for testing
      });

      expect(result.result.success).toBe(true);
      expect(result.attempts).toBe(3);
      expect(publishFn).toHaveBeenCalledTimes(3);
    });

    it("retries 429 rate limit errors", async () => {
      let callCount = 0;
      const publishFn = mock(async () => {
        callCount++;
        if (callCount === 1) {
          throw makePublishError(429, "Rate limited");
        }
        return {
          platform: "devto" as const,
          success: true,
          url: "https://dev.to/user/post",
        };
      });

      const result = await publishWithRetry({
        publishFn,
        platform: "devto",
        postId: "post-1",
        delays: [10, 10, 10],
      });

      expect(result.result.success).toBe(true);
      expect(result.attempts).toBe(2);
    });

    it("returns failure after exhausting all retry attempts", async () => {
      const publishFn = mock(async () => {
        throw makePublishError(503, "Service Unavailable");
      });

      const result = await publishWithRetry({
        publishFn,
        platform: "devto",
        postId: "post-1",
        maxAttempts: 3,
        delays: [10, 10],
      });

      expect(result.result.success).toBe(false);
      expect(result.result.error).toContain("Service Unavailable");
      expect(result.attempts).toBe(3);
      expect(publishFn).toHaveBeenCalledTimes(3);
    });

    it("emits publish_retry events on transient failures", async () => {
      let callCount = 0;
      const publishFn = mock(async () => {
        callCount++;
        if (callCount < 3) {
          throw makePublishError(500, "Server Error");
        }
        return {
          platform: "devto" as const,
          success: true,
          url: "https://dev.to/user/post",
        };
      });

      await publishWithRetry({
        publishFn,
        platform: "devto",
        postId: "post-1",
        workspaceId: "ws-1",
        delays: [10, 10, 10],
      });

      // Should have emitted retry events for the two failed attempts
      expect(mockEventBusEmit).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Network errors (no status code) → treated as transient
  // -------------------------------------------------------------------------

  describe("network errors", () => {
    it("retries network errors (no status code) as transient", async () => {
      let callCount = 0;
      const publishFn = mock(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error("fetch failed");
        }
        return {
          platform: "devto" as const,
          success: true,
          url: "https://dev.to/user/post",
        };
      });

      const result = await publishWithRetry({
        publishFn,
        platform: "devto",
        postId: "post-1",
        delays: [10, 10, 10],
      });

      expect(result.result.success).toBe(true);
      expect(result.attempts).toBe(2);
    });
  });
});
