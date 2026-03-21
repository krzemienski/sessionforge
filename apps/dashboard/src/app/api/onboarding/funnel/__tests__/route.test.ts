/**
 * Regression tests for POST /api/onboarding/funnel
 *
 * Verifies the fix that made `event` optional so clients sending only
 * {step} do not receive a 400 response. Mocks all external dependencies
 * so the suite runs without a real database or Next.js runtime.
 */

import { describe, it, expect, beforeEach, beforeAll, mock } from "bun:test";

// ---------------------------------------------------------------------------
// Mutable mock state
// ---------------------------------------------------------------------------

/** Controls what auth.api.getSession() resolves with. */
let mockAuthSession: { user: { id: string } } | null = {
  user: { id: "user-1" },
};

/** Captures the last values passed to db.insert().values(). */
let lastInsertValues: Record<string, unknown> | null = null;

/** When true, db.insert().values() rejects to simulate a DB error. */
let dbShouldFail = false;

// ---------------------------------------------------------------------------
// Module mocks (must be declared before importing the module under test)
// ---------------------------------------------------------------------------

mock.module("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: (_opts: unknown) => Promise.resolve(mockAuthSession),
    },
  },
}));

mock.module("next/headers", () => ({
  headers: () => Promise.resolve(new Headers()),
}));

mock.module("@sessionforge/db", () => ({
  onboardingFunnelEvents: { _tableName: "onboarding_funnel_events" },
}));

mock.module("@/lib/db", () => ({
  db: {
    insert: (_table: unknown) => ({
      values: (vals: Record<string, unknown>) => {
        if (dbShouldFail) return Promise.reject(new Error("DB error"));
        lastInsertValues = vals;
        return Promise.resolve();
      },
    }),
  },
}));

// Minimal NextResponse.json mock — returns a plain object so tests can
// inspect status and body without a real HTTP response.
mock.module("next/server", () => {
  const NextResponse = {
    json(data: unknown, init?: { status?: number }) {
      return {
        status: init?.status ?? 200,
        async json() {
          return data;
        },
      };
    },
  };
  return { NextResponse };
});

// ---------------------------------------------------------------------------
// Dynamic import AFTER all mocks are registered
// ---------------------------------------------------------------------------

let POST: (req: { json(): Promise<unknown> }) => Promise<{ status: number; json(): Promise<unknown> }>;

beforeAll(async () => {
  const mod = await import("../route");
  POST = mod.POST as typeof POST;
});

// ---------------------------------------------------------------------------
// Helper — builds a minimal request-like object the route handler can use
// ---------------------------------------------------------------------------

function makeRequest(body: unknown) {
  return {
    json: () => Promise.resolve(body),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/onboarding/funnel", () => {
  beforeEach(() => {
    mockAuthSession = { user: { id: "user-1" } };
    lastInsertValues = null;
    dbShouldFail = false;
  });

  describe("authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockAuthSession = null;
      const res = await POST(makeRequest({ step: "welcome" }));
      expect(res.status).toBe(401);
      const json = await res.json();
      expect((json as Record<string, unknown>).error).toBe("Unauthorized");
    });
  });

  describe("validation", () => {
    it("returns 400 when step is missing", async () => {
      const res = await POST(makeRequest({ event: "click" }));
      expect(res.status).toBe(400);
      const json = await res.json() as Record<string, unknown>;
      expect(json.error).toBe("step is required");
    });

    it("returns 400 when body is empty", async () => {
      const res = await POST(makeRequest({}));
      expect(res.status).toBe(400);
      const json = await res.json() as Record<string, unknown>;
      expect(json.error).toBe("step is required");
    });
  });

  describe("regression: event field is optional", () => {
    it("returns 200 when only {step} is provided (no event)", async () => {
      const res = await POST(makeRequest({ step: "welcome" }));
      expect(res.status).toBe(200);
      const json = await res.json() as Record<string, unknown>;
      expect(json.success).toBe(true);
    });

    it("defaults event to 'unknown' when not provided", async () => {
      await POST(makeRequest({ step: "welcome" }));
      expect(lastInsertValues?.event).toBe("unknown");
    });

    it("records the correct step when only {step} is provided", async () => {
      await POST(makeRequest({ step: "profile" }));
      expect(lastInsertValues?.step).toBe("profile");
    });
  });

  describe("full payload: {step, event}", () => {
    it("returns 200 when both step and event are provided", async () => {
      const res = await POST(makeRequest({ step: "welcome", event: "viewed" }));
      expect(res.status).toBe(200);
      const json = await res.json() as Record<string, unknown>;
      expect(json.success).toBe(true);
    });

    it("persists step and event when both are provided", async () => {
      await POST(makeRequest({ step: "connect", event: "clicked" }));
      expect(lastInsertValues?.step).toBe("connect");
      expect(lastInsertValues?.event).toBe("clicked");
    });

    it("persists metadata when provided", async () => {
      await POST(makeRequest({ step: "welcome", metadata: { source: "email" } }));
      expect(lastInsertValues?.metadata).toEqual({ source: "email" });
    });

    it("sets metadata to null when not provided", async () => {
      await POST(makeRequest({ step: "welcome" }));
      expect(lastInsertValues?.metadata).toBeNull();
    });

    it("persists the authenticated user id", async () => {
      await POST(makeRequest({ step: "welcome" }));
      expect(lastInsertValues?.userId).toBe("user-1");
    });
  });

  describe("database error handling", () => {
    it("returns 500 when the database insert fails", async () => {
      dbShouldFail = true;
      const res = await POST(makeRequest({ step: "welcome" }));
      expect(res.status).toBe(500);
      const json = await res.json() as Record<string, unknown>;
      expect(json.error).toBe("Failed to record event");
    });
  });
});
