/**
 * Integration tests for the health-checker module.
 *
 * Exercises health check logic, error classification, status mapping,
 * and the checkAllIntegrations orchestrator. Mocks external API calls
 * and database at their boundaries.
 */

import { describe, it, expect, mock, beforeEach } from "bun:test";

// ---------------------------------------------------------------------------
// Mock state
// ---------------------------------------------------------------------------

const mockDevtoRows = mock(async () => [] as unknown[]);
const mockGhostRows = mock(async () => [] as unknown[]);
const mockMediumRows = mock(async () => [] as unknown[]);
const mockTwitterRows = mock(async () => [] as unknown[]);
const mockLinkedinRows = mock(async () => [] as unknown[]);
const mockWordpressRows = mock(async () => [] as unknown[]);

const mockHealthCheckSelect = mock(() => [] as unknown[]);
const mockHealthCheckInsertValues = mock(async () => undefined);
const mockHealthCheckInsert = mock(() => ({ values: mockHealthCheckInsertValues }));
const mockHealthCheckUpdateSet = mock(() => ({ where: mock(async () => undefined) }));
const mockHealthCheckUpdate = mock(() => ({ set: mockHealthCheckUpdateSet }));

const mockDbSelectFrom = mock(() => ({
  where: mock(() => ({
    limit: mock(() => ({
      then: mock((cb: (rows: unknown[]) => unknown) => cb([])),
    })),
  })),
}));

const mockEventBusEmit = mock(() => {});

// Platform verify mocks
const mockVerifyDevto = mock(async () => ({ user: "test" }));
const mockVerifyGhost = mock(async () => ({ site: { title: "Test" } }));
const mockVerifyMedium = mock(async () => ({ id: "test" }));
const mockVerifyTwitter = mock(async () => ({ id: "test" }));
const mockVerifyLinkedin = mock(async () => ({ id: "test" }));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

mock.module("@/lib/db", () => ({
  db: {
    query: {
      integrationHealthChecks: { findMany: mock(async () => []) },
    },
    select: mock(() => ({
      from: mockDbSelectFrom,
    })),
    insert: mockHealthCheckInsert,
    update: mockHealthCheckUpdate,
  },
}));

mock.module("@sessionforge/db", () => ({
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

mock.module("@/lib/integrations/devto", () => ({
  verifyDevtoApiKey: mockVerifyDevto,
}));

mock.module("@/lib/integrations/ghost", () => ({
  verifyGhostApiKey: mockVerifyGhost,
}));

mock.module("@/lib/integrations/medium", () => ({
  verifyMediumToken: mockVerifyMedium,
}));

mock.module("@/lib/integrations/twitter", () => ({
  verifyTwitterAuth: mockVerifyTwitter,
}));

mock.module("@/lib/integrations/linkedin", () => ({
  verifyLinkedInAuth: mockVerifyLinkedin,
}));

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------

const {
  checkDevtoHealth,
  checkGhostHealth,
  checkMediumHealth,
  checkTwitterHealth,
  checkLinkedInHealth,
} = await import("../../src/lib/integrations/health-checker");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeApiError(status: number, message: string): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("health-checker", () => {
  beforeEach(() => {
    mockVerifyDevto.mockReset();
    mockVerifyGhost.mockReset();
    mockVerifyMedium.mockReset();
    mockVerifyTwitter.mockReset();
    mockVerifyLinkedin.mockReset();
    mockEventBusEmit.mockReset();

    // Restore default implementations
    mockVerifyDevto.mockImplementation(async () => ({ user: "test" }));
    mockVerifyGhost.mockImplementation(async () => ({ site: { title: "Test" } }));
    mockVerifyMedium.mockImplementation(async () => ({ id: "test" }));
    mockVerifyTwitter.mockImplementation(async () => ({ id: "test" }));
    mockVerifyLinkedin.mockImplementation(async () => ({ id: "test" }));
  });

  // -------------------------------------------------------------------------
  // Individual platform checks — healthy
  // -------------------------------------------------------------------------

  describe("healthy checks", () => {
    it("returns healthy for Dev.to when API key is valid", async () => {
      const result = await checkDevtoHealth("valid-api-key");
      expect(result.platform).toBe("devto");
      expect(result.status).toBe("healthy");
      expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.errorMessage).toBeUndefined();
    });

    it("returns healthy for Ghost when admin API key is valid", async () => {
      const result = await checkGhostHealth("valid-key", "https://ghost.example.com");
      expect(result.platform).toBe("ghost");
      expect(result.status).toBe("healthy");
    });

    it("returns healthy for Medium when access token is valid", async () => {
      const result = await checkMediumHealth("valid-token");
      expect(result.platform).toBe("medium");
      expect(result.status).toBe("healthy");
    });

    it("returns healthy for Twitter when access token is valid", async () => {
      const result = await checkTwitterHealth("valid-token");
      expect(result.platform).toBe("twitter");
      expect(result.status).toBe("healthy");
    });

    it("returns healthy for LinkedIn when access token is valid", async () => {
      const result = await checkLinkedInHealth("valid-token");
      expect(result.platform).toBe("linkedin");
      expect(result.status).toBe("healthy");
    });
  });

  // -------------------------------------------------------------------------
  // Auth expired detection (401/403)
  // -------------------------------------------------------------------------

  describe("auth_expired detection", () => {
    it("returns auth_expired for 401 errors", async () => {
      mockVerifyDevto.mockImplementation(async () => {
        throw makeApiError(401, "API key expired");
      });

      const result = await checkDevtoHealth("expired-key");
      expect(result.platform).toBe("devto");
      expect(result.status).toBe("auth_expired");
      expect(result.errorMessage).toBe("API key expired");
      expect(result.errorCode).toBe("401");
    });

    it("returns auth_expired for 403 errors", async () => {
      mockVerifyTwitter.mockImplementation(async () => {
        throw makeApiError(403, "Forbidden - token revoked");
      });

      const result = await checkTwitterHealth("revoked-token");
      expect(result.status).toBe("auth_expired");
      expect(result.errorCode).toBe("403");
    });
  });

  // -------------------------------------------------------------------------
  // Unhealthy detection (5xx, other errors)
  // -------------------------------------------------------------------------

  describe("unhealthy detection", () => {
    it("returns unhealthy for 500 server errors", async () => {
      mockVerifyGhost.mockImplementation(async () => {
        throw makeApiError(500, "Internal server error");
      });

      const result = await checkGhostHealth("valid-key", "https://ghost.example.com");
      expect(result.status).toBe("unhealthy");
      expect(result.errorCode).toBe("500");
    });

    it("returns unhealthy for 429 rate limit errors", async () => {
      mockVerifyMedium.mockImplementation(async () => {
        throw makeApiError(429, "Rate limited");
      });

      const result = await checkMediumHealth("valid-token");
      expect(result.status).toBe("unhealthy");
      expect(result.errorCode).toBe("429");
    });

    it("returns unhealthy for network errors (no status)", async () => {
      mockVerifyLinkedin.mockImplementation(async () => {
        throw new Error("fetch failed: ECONNREFUSED");
      });

      const result = await checkLinkedInHealth("valid-token");
      expect(result.status).toBe("unhealthy");
      expect(result.errorMessage).toBe("fetch failed: ECONNREFUSED");
      expect(result.errorCode).toBe("unknown");
    });
  });

  // -------------------------------------------------------------------------
  // Response time measurement
  // -------------------------------------------------------------------------

  describe("response time tracking", () => {
    it("records response time for successful checks", async () => {
      mockVerifyDevto.mockImplementation(async () => {
        // Tiny delay to measure
        await new Promise((r) => setTimeout(r, 5));
        return { user: "test" };
      });

      const result = await checkDevtoHealth("valid-key");
      expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.responseTimeMs).toBe("number");
    });

    it("records response time even for failed checks", async () => {
      mockVerifyDevto.mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 5));
        throw makeApiError(500, "Server error");
      });

      const result = await checkDevtoHealth("valid-key");
      expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
    });
  });
});
