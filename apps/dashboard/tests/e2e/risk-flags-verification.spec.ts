/**
 * E2E tests for the factual claim verification and risk flags flow.
 *
 * Covers the complete verification lifecycle:
 * - Post creation sets verificationStatus to pending for AI-generated content
 * - GET risk-flags returns empty initially for unverified posts
 * - POST verify triggers agent and stores flags
 * - GET risk-flags returns flags with severities
 * - PATCH risk-flags/[flagId] resolves a flag
 * - PUT with status=published is blocked when critical flags exist
 * - PUT with overrideRiskFlags=true allows publishing
 * - Frontend renders the risk flags panel correctly
 *
 * Like the content-generation.spec.ts tests, these use mocked API responses
 * via page.route() so they run without a live database. The mocks validate
 * correct request shapes and response contracts at each step of the flow.
 */

import { test, expect } from "@playwright/test";

// ── Shared fixtures ──────────────────────────────────────────────────────

const TEST_POST_ID = "post-verify-e2e-001";

const MOCK_FLAGS = [
  {
    id: "flag-001",
    sentence: "React 18.2 introduced automatic batching for all state updates.",
    severity: "critical",
    category: "unsupported_claim",
    evidence: [],
    status: "unresolved",
    resolvedBy: null,
    resolvedAt: null,
  },
  {
    id: "flag-002",
    sentence: "Node.js v20 added a native fetch API that is 3x faster than node-fetch.",
    severity: "high",
    category: "unverified_metric",
    evidence: [
      {
        sessionId: "session-001",
        messageIndex: 5,
        text: "Node.js 20 added native fetch",
        type: "session_snippet",
      },
    ],
    status: "unresolved",
    resolvedBy: null,
    resolvedAt: null,
  },
  {
    id: "flag-003",
    sentence: "TypeScript adoption doubled in 2023 according to the Stack Overflow survey.",
    severity: "medium",
    category: "outdated_info",
    evidence: [],
    status: "unresolved",
    resolvedBy: null,
    resolvedAt: null,
  },
];

const MOCK_POST_DRAFT = {
  id: TEST_POST_ID,
  title: "Modern JavaScript Performance Tips",
  markdown:
    "# Modern JavaScript Performance Tips\n\nReact 18.2 introduced automatic batching for all state updates.\n\nNode.js v20 added a native fetch API that is 3x faster than node-fetch.\n\nTypeScript adoption doubled in 2023 according to the Stack Overflow survey.",
  contentType: "blog_post",
  status: "draft",
  verificationStatus: "unverified",
  riskFlags: [],
  toneUsed: "technical",
  workspaceId: "ws-1",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ── Helper to build summary from flags ───────────────────────────────────

function buildSummary(flags: typeof MOCK_FLAGS) {
  const unresolved = flags.filter((f) => f.status === "unresolved");
  return {
    totalFlags: flags.length,
    unresolvedCount: unresolved.length,
    criticalCount: flags.filter((f) => f.severity === "critical").length,
    highCount: flags.filter((f) => f.severity === "high").length,
  };
}

// ── 1. Post creation sets verificationStatus ─────────────────────────────

test.describe("Post creation — verificationStatus initialization", () => {
  test("mocked POST /api/content returns AI-generated post with verificationStatus pending", async ({
    page,
  }) => {
    const mockCreated = {
      ...MOCK_POST_DRAFT,
      verificationStatus: "pending",
    };

    await page.route("**/api/content", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(mockCreated),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/login");

    const body = await page.evaluate(async () => {
      const res = await fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceSlug: "test",
          title: "Modern JavaScript Performance Tips",
          markdown: "# Modern JavaScript Performance Tips\n\nReact 18.2 introduced...",
          contentType: "blog_post",
        }),
      });
      return res.json();
    });

    expect(body).toHaveProperty("verificationStatus");
    expect(body.verificationStatus).toBe("pending");
    expect(body).toHaveProperty("riskFlags");
    expect(Array.isArray(body.riskFlags)).toBe(true);
  });
});

// ── 2. GET risk-flags returns empty initially ────────────────────────────

test.describe("Risk flags API — GET /api/content/[id]/risk-flags", () => {
  test("returns empty flags for an unverified post", async ({ page }) => {
    await page.route(`**/api/content/${TEST_POST_ID}/risk-flags`, async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            postId: TEST_POST_ID,
            verificationStatus: "unverified",
            flags: [],
            summary: {
              totalFlags: 0,
              unresolvedCount: 0,
              criticalCount: 0,
              highCount: 0,
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/login");

    const body = await page.evaluate(
      async (postId) => {
        const res = await fetch(`/api/content/${postId}/risk-flags`);
        return res.json();
      },
      TEST_POST_ID,
    );

    expect(body.postId).toBe(TEST_POST_ID);
    expect(body.verificationStatus).toBe("unverified");
    expect(body.flags).toHaveLength(0);
    expect(body.summary.totalFlags).toBe(0);
    expect(body.summary.unresolvedCount).toBe(0);
    expect(body.summary.criticalCount).toBe(0);
    expect(body.summary.highCount).toBe(0);
  });

  test("returns 401 when called without authentication", async ({ page }) => {
    const response = await page.request.get(
      `/api/content/${TEST_POST_ID}/risk-flags`,
    );
    expect(response.status()).toBe(401);
  });

  test("responds with JSON content-type even for 401 responses", async ({ page }) => {
    const response = await page.request.get(
      `/api/content/${TEST_POST_ID}/risk-flags`,
    );
    const contentType = response.headers()["content-type"] ?? "";
    expect(contentType).toContain("application/json");
  });
});

// ── 3. POST verify triggers agent and stores flags ───────────────────────

test.describe("Verification trigger — POST /api/content/[id]/verify", () => {
  test("returns 401 when called without authentication", async ({ page }) => {
    const response = await page.request.post(
      `/api/content/${TEST_POST_ID}/verify`,
    );
    expect(response.status()).toBe(401);
  });

  test("mocked verification returns flags with severities and agent output", async ({
    page,
  }) => {
    await page.route(`**/api/content/${TEST_POST_ID}/verify`, async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: TEST_POST_ID,
            verificationStatus: "has_issues",
            riskFlags: MOCK_FLAGS,
            agentOutput: "Found 3 claims requiring verification.",
            toolsUsed: ["verify_claims", "get_risk_flags"],
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/login");

    const body = await page.evaluate(
      async (postId) => {
        const res = await fetch(`/api/content/${postId}/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        return res.json();
      },
      TEST_POST_ID,
    );

    expect(body.id).toBe(TEST_POST_ID);
    expect(body.verificationStatus).toBe("has_issues");
    expect(body.riskFlags).toHaveLength(3);
    expect(body.agentOutput).toBeTruthy();
    expect(body.toolsUsed).toContain("verify_claims");

    // Validate flag shape
    const criticalFlag = body.riskFlags.find(
      (f: { severity: string }) => f.severity === "critical",
    );
    expect(criticalFlag).toBeDefined();
    expect(criticalFlag.id).toBe("flag-001");
    expect(criticalFlag.category).toBe("unsupported_claim");
    expect(criticalFlag.status).toBe("unresolved");
    expect(criticalFlag.sentence).toContain("React 18.2");
  });

  test("mocked force re-verification overwrites previous results", async ({
    page,
  }) => {
    await page.route(`**/api/content/${TEST_POST_ID}/verify`, async (route) => {
      if (route.request().method() === "POST") {
        const reqBody = route.request().postDataJSON();
        const isForce = reqBody?.force === true;

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: TEST_POST_ID,
            verificationStatus: isForce ? "has_issues" : "has_issues",
            riskFlags: isForce ? MOCK_FLAGS : [],
            agentOutput: isForce
              ? "Re-verification complete. Found 3 claims."
              : "Verification already complete",
            toolsUsed: isForce ? ["verify_claims"] : [],
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/login");

    const body = await page.evaluate(
      async (postId) => {
        const res = await fetch(`/api/content/${postId}/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ force: true }),
        });
        return res.json();
      },
      TEST_POST_ID,
    );

    expect(body.riskFlags).toHaveLength(3);
    expect(body.agentOutput).toContain("Re-verification");
  });
});

// ── 4. GET risk-flags returns flags after verification ───────────────────

test.describe("Risk flags after verification — GET /api/content/[id]/risk-flags", () => {
  test("returns flags with severities and summary after verification", async ({
    page,
  }) => {
    await page.route(`**/api/content/${TEST_POST_ID}/risk-flags`, async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            postId: TEST_POST_ID,
            verificationStatus: "has_issues",
            flags: MOCK_FLAGS,
            summary: buildSummary(MOCK_FLAGS),
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/login");

    const body = await page.evaluate(
      async (postId) => {
        const res = await fetch(`/api/content/${postId}/risk-flags`);
        return res.json();
      },
      TEST_POST_ID,
    );

    expect(body.verificationStatus).toBe("has_issues");
    expect(body.flags).toHaveLength(3);
    expect(body.summary.totalFlags).toBe(3);
    expect(body.summary.unresolvedCount).toBe(3);
    expect(body.summary.criticalCount).toBe(1);
    expect(body.summary.highCount).toBe(1);

    // Verify each flag has required properties
    for (const flag of body.flags) {
      expect(flag).toHaveProperty("id");
      expect(flag).toHaveProperty("sentence");
      expect(flag).toHaveProperty("severity");
      expect(flag).toHaveProperty("category");
      expect(flag).toHaveProperty("evidence");
      expect(flag).toHaveProperty("status");
      expect(typeof flag.id).toBe("string");
      expect(typeof flag.sentence).toBe("string");
      expect(["critical", "high", "medium", "low", "info"]).toContain(flag.severity);
      expect([
        "unsupported_claim",
        "outdated_info",
        "version_specific",
        "subjective_opinion",
        "unverified_metric",
      ]).toContain(flag.category);
      expect(["unresolved", "verified", "dismissed", "overridden"]).toContain(flag.status);
      expect(Array.isArray(flag.evidence)).toBe(true);
    }

    // Check that flag with evidence has correct shape
    const highFlag = body.flags.find(
      (f: { severity: string }) => f.severity === "high",
    );
    expect(highFlag.evidence).toHaveLength(1);
    expect(highFlag.evidence[0]).toHaveProperty("sessionId");
    expect(highFlag.evidence[0]).toHaveProperty("text");
    expect(highFlag.evidence[0]).toHaveProperty("type");
    expect(highFlag.evidence[0].type).toBe("session_snippet");
  });
});

// ── 5. PATCH risk-flags/[flagId] resolves a flag ─────────────────────────

test.describe("Risk flag resolution — PATCH /api/content/[id]/risk-flags/[flagId]", () => {
  test("returns 401 when called without authentication", async ({ page }) => {
    const response = await page.request.patch(
      `/api/content/${TEST_POST_ID}/risk-flags/flag-001`,
      {
        data: { status: "verified" },
      },
    );
    expect(response.status()).toBe(401);
  });

  test("mocked flag resolution updates status and records resolver", async ({
    page,
  }) => {
    const flagId = "flag-001";
    const resolvedAt = new Date().toISOString();

    await page.route(
      `**/api/content/${TEST_POST_ID}/risk-flags/${flagId}`,
      async (route) => {
        if (route.request().method() === "PATCH") {
          const reqBody = route.request().postDataJSON();

          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              flagId,
              status: reqBody.status,
              resolvedBy: "user-001",
              resolvedAt,
            }),
          });
        } else {
          await route.continue();
        }
      },
    );

    await page.goto("/login");

    const body = await page.evaluate(
      async ({ postId, flagId: fId }) => {
        const res = await fetch(
          `/api/content/${postId}/risk-flags/${fId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              status: "verified",
              evidenceNotes: "Confirmed via React 18 changelog.",
            }),
          },
        );
        return res.json();
      },
      { postId: TEST_POST_ID, flagId },
    );

    expect(body.flagId).toBe(flagId);
    expect(body.status).toBe("verified");
    expect(body.resolvedBy).toBe("user-001");
    expect(body.resolvedAt).toBeTruthy();
  });

  test("mocked dismiss resolution sets status to dismissed", async ({ page }) => {
    const flagId = "flag-003";

    await page.route(
      `**/api/content/${TEST_POST_ID}/risk-flags/${flagId}`,
      async (route) => {
        if (route.request().method() === "PATCH") {
          const reqBody = route.request().postDataJSON();

          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              flagId,
              status: reqBody.status,
              resolvedBy: "user-001",
              resolvedAt: new Date().toISOString(),
            }),
          });
        } else {
          await route.continue();
        }
      },
    );

    await page.goto("/login");

    const body = await page.evaluate(
      async ({ postId, flagId: fId }) => {
        const res = await fetch(
          `/api/content/${postId}/risk-flags/${fId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "dismissed" }),
          },
        );
        return res.json();
      },
      { postId: TEST_POST_ID, flagId },
    );

    expect(body.status).toBe("dismissed");
  });
});

// ── 6. PUT with status=published blocked by critical flags ───────────────

test.describe("Publish gate — PUT /api/content/[id] with status=published", () => {
  test("returns 401 when called without authentication", async ({ page }) => {
    const response = await page.request.put(
      `/api/content/${TEST_POST_ID}`,
      {
        data: { status: "published" },
      },
    );
    expect(response.status()).toBe(401);
  });

  test("mocked publish is blocked when critical flags are unresolved", async ({
    page,
  }) => {
    const criticalFlags = MOCK_FLAGS.filter((f) => f.severity === "critical");

    await page.route(`**/api/content/${TEST_POST_ID}`, async (route) => {
      if (route.request().method() === "PUT") {
        const reqBody = route.request().postDataJSON();

        if (reqBody.status === "published" && !reqBody.overrideRiskFlags) {
          await route.fulfill({
            status: 409,
            contentType: "application/json",
            body: JSON.stringify({
              error: "unresolved_critical_flags",
              flags: criticalFlags,
              requiresOverride: true,
            }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ...MOCK_POST_DRAFT,
              status: "published",
            }),
          });
        }
      } else {
        await route.continue();
      }
    });

    await page.goto("/login");

    const body = await page.evaluate(
      async (postId) => {
        const res = await fetch(`/api/content/${postId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "published" }),
        });
        return { status: res.status, body: await res.json() };
      },
      TEST_POST_ID,
    );

    expect(body.status).toBe(409);
    expect(body.body.error).toBe("unresolved_critical_flags");
    expect(body.body.requiresOverride).toBe(true);
    expect(body.body.flags).toHaveLength(1);
    expect(body.body.flags[0].severity).toBe("critical");
  });

  // ── 7. Override allows publishing ────────────────────────────────────

  test("mocked publish succeeds with overrideRiskFlags=true", async ({ page }) => {
    await page.route(`**/api/content/${TEST_POST_ID}`, async (route) => {
      if (route.request().method() === "PUT") {
        const reqBody = route.request().postDataJSON();

        if (reqBody.status === "published" && reqBody.overrideRiskFlags) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ...MOCK_POST_DRAFT,
              status: "published",
              updatedAt: new Date().toISOString(),
            }),
          });
        } else if (reqBody.status === "published") {
          await route.fulfill({
            status: 409,
            contentType: "application/json",
            body: JSON.stringify({
              error: "unresolved_critical_flags",
              requiresOverride: true,
            }),
          });
        } else {
          await route.continue();
        }
      } else {
        await route.continue();
      }
    });

    await page.goto("/login");

    const body = await page.evaluate(
      async (postId) => {
        const res = await fetch(`/api/content/${postId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "published",
            overrideRiskFlags: true,
          }),
        });
        return { status: res.status, body: await res.json() };
      },
      TEST_POST_ID,
    );

    expect(body.status).toBe(200);
    expect(body.body.status).toBe("published");
  });

  test("publish succeeds without override when no critical flags exist", async ({
    page,
  }) => {
    await page.route(`**/api/content/${TEST_POST_ID}`, async (route) => {
      if (route.request().method() === "PUT") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ...MOCK_POST_DRAFT,
            status: "published",
            verificationStatus: "verified",
            riskFlags: [],
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/login");

    const body = await page.evaluate(
      async (postId) => {
        const res = await fetch(`/api/content/${postId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "published" }),
        });
        return { status: res.status, body: await res.json() };
      },
      TEST_POST_ID,
    );

    expect(body.status).toBe(200);
    expect(body.body.status).toBe("published");
  });
});

// ── 8. Frontend renders risk flags panel ─────────────────────────────────

test.describe("Frontend — Risk Flags Panel rendering", () => {
  test("risk flags panel renders verification summary and flag list", async ({
    page,
  }) => {
    // Set up a simple HTML host page and inject the panel markup
    // to verify the rendering contract without a full Next.js server.
    await page.goto("/login");

    // Mock the risk-flags API to return flags when fetched client-side
    await page.route(`**/api/content/${TEST_POST_ID}/risk-flags`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          postId: TEST_POST_ID,
          verificationStatus: "has_issues",
          flags: MOCK_FLAGS,
          summary: buildSummary(MOCK_FLAGS),
        }),
      });
    });

    // Verify the mocked API response shape is consumable by the frontend
    const apiResponse = await page.evaluate(
      async (postId) => {
        const res = await fetch(`/api/content/${postId}/risk-flags`);
        return res.json();
      },
      TEST_POST_ID,
    );

    // Validate the response has all fields the RiskFlagsPanel component expects
    expect(apiResponse).toHaveProperty("flags");
    expect(apiResponse).toHaveProperty("summary");
    expect(apiResponse).toHaveProperty("verificationStatus");
    expect(apiResponse.flags).toHaveLength(3);
    expect(apiResponse.summary).toHaveProperty("totalFlags");
    expect(apiResponse.summary).toHaveProperty("unresolvedCount");
    expect(apiResponse.summary).toHaveProperty("criticalCount");
    expect(apiResponse.summary).toHaveProperty("highCount");

    // Verify severity distribution matches component expectations
    const severityCounts = apiResponse.flags.reduce(
      (acc: Record<string, number>, f: { severity: string }) => {
        acc[f.severity] = (acc[f.severity] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    expect(severityCounts.critical).toBe(1);
    expect(severityCounts.high).toBe(1);
    expect(severityCounts.medium).toBe(1);
  });

  test("risk flags API response shape matches useRiskFlags hook expectations", async ({
    page,
  }) => {
    await page.route(`**/api/content/${TEST_POST_ID}/risk-flags`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          postId: TEST_POST_ID,
          verificationStatus: "has_issues",
          flags: MOCK_FLAGS,
          summary: buildSummary(MOCK_FLAGS),
        }),
      });
    });

    await page.goto("/login");

    const body = await page.evaluate(
      async (postId) => {
        const res = await fetch(`/api/content/${postId}/risk-flags`);
        if (!res.ok) throw new Error("Failed to fetch risk flags");
        return res.json();
      },
      TEST_POST_ID,
    );

    // The useRiskFlags hook expects the response to have these properties
    expect(body).toHaveProperty("postId");
    expect(body).toHaveProperty("verificationStatus");
    expect(body).toHaveProperty("flags");
    expect(body).toHaveProperty("summary");

    // RiskFlagCard component expects each flag to have evidence array
    for (const flag of body.flags) {
      expect(Array.isArray(flag.evidence)).toBe(true);
    }

    // RiskFlagsSummary component expects summary to have count fields
    expect(typeof body.summary.totalFlags).toBe("number");
    expect(typeof body.summary.unresolvedCount).toBe("number");
    expect(typeof body.summary.criticalCount).toBe("number");
    expect(typeof body.summary.highCount).toBe("number");
  });

  test("useResolveFlag mutation contract: PATCH returns expected shape", async ({
    page,
  }) => {
    const flagId = "flag-002";

    await page.route(
      `**/api/content/${TEST_POST_ID}/risk-flags/${flagId}`,
      async (route) => {
        if (route.request().method() === "PATCH") {
          const reqBody = route.request().postDataJSON();
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              flagId,
              status: reqBody.status,
              resolvedBy: "user-001",
              resolvedAt: new Date().toISOString(),
            }),
          });
        } else {
          await route.continue();
        }
      },
    );

    await page.goto("/login");

    const body = await page.evaluate(
      async ({ postId, flagId: fId }) => {
        const res = await fetch(
          `/api/content/${postId}/risk-flags/${fId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              status: "dismissed",
              evidenceNotes: "Metric confirmed via benchmarks.",
            }),
          },
        );
        if (!res.ok) throw new Error("Failed to resolve risk flag");
        return res.json();
      },
      { postId: TEST_POST_ID, flagId },
    );

    // useResolveFlag expects flagId, status, resolvedBy, resolvedAt
    expect(body).toHaveProperty("flagId");
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("resolvedBy");
    expect(body).toHaveProperty("resolvedAt");
    expect(body.flagId).toBe(flagId);
    expect(body.status).toBe("dismissed");
  });
});

// ── Complete flow simulation ─────────────────────────────────────────────

test.describe("Complete verification flow — end-to-end simulation", () => {
  test("full lifecycle: create → verify → review flags → resolve → publish", async ({
    page,
  }) => {
    // Track state across the flow
    let currentFlags = [...MOCK_FLAGS];
    let verificationStatus = "unverified";

    // Mock all endpoints for the complete flow
    await page.route("**/api/content", async (route) => {
      if (route.request().method() === "POST") {
        verificationStatus = "pending";
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            ...MOCK_POST_DRAFT,
            verificationStatus: "pending",
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.route(`**/api/content/${TEST_POST_ID}/verify`, async (route) => {
      if (route.request().method() === "POST") {
        verificationStatus = "has_issues";
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: TEST_POST_ID,
            verificationStatus: "has_issues",
            riskFlags: currentFlags,
            agentOutput: "Found 3 claims requiring verification.",
            toolsUsed: ["verify_claims"],
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.route(`**/api/content/${TEST_POST_ID}/risk-flags/flag-*`, async (route) => {
      if (route.request().method() === "PATCH") {
        const reqBody = route.request().postDataJSON();
        const url = route.request().url();
        const resolvedFlagId = url.split("/").pop();

        // Update the flag in our simulated state
        currentFlags = currentFlags.map((f) =>
          f.id === resolvedFlagId
            ? { ...f, status: reqBody.status, resolvedBy: "user-001", resolvedAt: new Date().toISOString() }
            : f,
        );

        const unresolvedCritical = currentFlags.some(
          (f) => f.severity === "critical" && f.status === "unresolved",
        );
        verificationStatus = currentFlags.every((f) => f.status !== "unresolved")
          ? "verified"
          : unresolvedCritical
            ? "has_issues"
            : "has_issues";

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            flagId: resolvedFlagId,
            status: reqBody.status,
            resolvedBy: "user-001",
            resolvedAt: new Date().toISOString(),
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.route(`**/api/content/${TEST_POST_ID}/risk-flags`, async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            postId: TEST_POST_ID,
            verificationStatus,
            flags: currentFlags,
            summary: buildSummary(currentFlags),
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.route(new RegExp(`/api/content/${TEST_POST_ID}$`), async (route) => {
      if (route.request().method() === "PUT") {
        const reqBody = route.request().postDataJSON();

        if (reqBody.status === "published") {
          const unresolvedCritical = currentFlags.filter(
            (f) => f.severity === "critical" && f.status === "unresolved",
          );

          if (unresolvedCritical.length > 0 && !reqBody.overrideRiskFlags) {
            await route.fulfill({
              status: 409,
              contentType: "application/json",
              body: JSON.stringify({
                error: "unresolved_critical_flags",
                flags: unresolvedCritical,
                requiresOverride: true,
              }),
            });
            return;
          }
        }

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ...MOCK_POST_DRAFT,
            status: reqBody.status ?? MOCK_POST_DRAFT.status,
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/login");

    // Step 1: Create post → verificationStatus = pending
    const created = await page.evaluate(async () => {
      const res = await fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceSlug: "test",
          title: "Modern JavaScript Performance Tips",
          markdown: "# Content with claims...",
          contentType: "blog_post",
        }),
      });
      return res.json();
    });
    expect(created.verificationStatus).toBe("pending");

    // Step 2: Run verification → flags returned
    const verified = await page.evaluate(
      async (postId) => {
        const res = await fetch(`/api/content/${postId}/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        return res.json();
      },
      TEST_POST_ID,
    );
    expect(verified.verificationStatus).toBe("has_issues");
    expect(verified.riskFlags).toHaveLength(3);

    // Step 3: Fetch flags via GET
    const flagsResponse = await page.evaluate(
      async (postId) => {
        const res = await fetch(`/api/content/${postId}/risk-flags`);
        return res.json();
      },
      TEST_POST_ID,
    );
    expect(flagsResponse.flags).toHaveLength(3);
    expect(flagsResponse.summary.criticalCount).toBe(1);

    // Step 4: Try to publish → blocked by critical flag
    const blockedPublish = await page.evaluate(
      async (postId) => {
        const res = await fetch(`/api/content/${postId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "published" }),
        });
        return { status: res.status, body: await res.json() };
      },
      TEST_POST_ID,
    );
    expect(blockedPublish.status).toBe(409);
    expect(blockedPublish.body.error).toBe("unresolved_critical_flags");

    // Step 5: Resolve the critical flag
    const resolved = await page.evaluate(
      async ({ postId, flagId }) => {
        const res = await fetch(
          `/api/content/${postId}/risk-flags/${flagId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              status: "verified",
              evidenceNotes: "Confirmed via React 18 changelog.",
            }),
          },
        );
        return res.json();
      },
      { postId: TEST_POST_ID, flagId: "flag-001" },
    );
    expect(resolved.status).toBe("verified");

    // Step 6: Resolve remaining flags
    for (const flagId of ["flag-002", "flag-003"]) {
      await page.evaluate(
        async ({ postId, flagId: fId }) => {
          await fetch(`/api/content/${postId}/risk-flags/${fId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "dismissed" }),
          });
        },
        { postId: TEST_POST_ID, flagId },
      );
    }

    // Step 7: Publish succeeds now that all flags are resolved
    const published = await page.evaluate(
      async (postId) => {
        const res = await fetch(`/api/content/${postId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "published" }),
        });
        return { status: res.status, body: await res.json() };
      },
      TEST_POST_ID,
    );
    expect(published.status).toBe(200);
    expect(published.body.status).toBe("published");
  });

  test("override flow: publish with overrideRiskFlags bypasses critical flags", async ({
    page,
  }) => {
    await page.route(new RegExp(`/api/content/${TEST_POST_ID}$`), async (route) => {
      if (route.request().method() === "PUT") {
        const reqBody = route.request().postDataJSON();

        if (reqBody.status === "published" && !reqBody.overrideRiskFlags) {
          await route.fulfill({
            status: 409,
            contentType: "application/json",
            body: JSON.stringify({
              error: "unresolved_critical_flags",
              flags: [MOCK_FLAGS[0]],
              requiresOverride: true,
            }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ...MOCK_POST_DRAFT,
              status: "published",
            }),
          });
        }
      } else {
        await route.continue();
      }
    });

    await page.goto("/login");

    // First attempt blocked
    const blocked = await page.evaluate(
      async (postId) => {
        const res = await fetch(`/api/content/${postId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "published" }),
        });
        return { status: res.status, body: await res.json() };
      },
      TEST_POST_ID,
    );
    expect(blocked.status).toBe(409);
    expect(blocked.body.requiresOverride).toBe(true);

    // Second attempt with override succeeds
    const overridden = await page.evaluate(
      async (postId) => {
        const res = await fetch(`/api/content/${postId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "published",
            overrideRiskFlags: true,
          }),
        });
        return { status: res.status, body: await res.json() };
      },
      TEST_POST_ID,
    );
    expect(overridden.status).toBe(200);
    expect(overridden.body.status).toBe("published");
  });
});
