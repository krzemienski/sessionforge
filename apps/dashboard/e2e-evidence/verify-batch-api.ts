/**
 * E2E API verification script for batch operations (subtask-6-3).
 * Verifies auth guards, input validation, and endpoint availability
 * for the complete batch extract-insights flow.
 */

const BASE = "http://localhost:3001";

type TestResult = {
  name: string;
  status: "PASS" | "FAIL";
  details: string;
};

async function check(
  name: string,
  fn: () => Promise<{ status: number; body: unknown }>
): Promise<TestResult> {
  try {
    const { status, body } = await fn();
    return { name, status: "PASS", details: `HTTP ${status} → ${JSON.stringify(body)}` };
  } catch (err) {
    return { name, status: "FAIL", details: String(err) };
  }
}

async function req(url: string, opts: RequestInit = {}): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${BASE}${url}`, opts);
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

async function assertStatus(name: string, url: string, opts: RequestInit, expected: number): Promise<TestResult> {
  return check(name, async () => {
    const { status, body } = await req(url, opts);
    if (status !== expected) throw new Error(`Expected ${expected}, got ${status}: ${JSON.stringify(body)}`);
    return { status, body };
  });
}

async function main() {
  const results: TestResult[] = [];

  console.log("=== E2E API Verification: Batch Operations (subtask-6-3) ===\n");

  // J1: Auth guards on all batch endpoints
  results.push(await assertStatus(
    "J1.1 POST /api/sessions/batch → 401 (unauthenticated)",
    "/api/sessions/batch",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation: "extract_insights", sessionIds: ["test"], workspaceSlug: "test" }) },
    401
  ));

  results.push(await assertStatus(
    "J1.2 POST /api/insights/batch → 401 (unauthenticated)",
    "/api/insights/batch",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation: "generate_content", insightIds: ["test"], workspaceSlug: "test" }) },
    401
  ));

  results.push(await assertStatus(
    "J1.3 POST /api/posts/batch → 401 (unauthenticated)",
    "/api/posts/batch",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation: "archive", postIds: ["test"], workspaceSlug: "test" }) },
    401
  ));

  results.push(await assertStatus(
    "J1.4 GET /api/jobs/test-id → 401 (unauthenticated)",
    "/api/jobs/test-job-id",
    { method: "GET" },
    401
  ));

  results.push(await assertStatus(
    "J1.5 POST /api/jobs/test-id/cancel → 401 (unauthenticated)",
    "/api/jobs/test-job-id/cancel",
    { method: "POST" },
    401
  ));

  // J2: Input validation on batch sessions (missing fields)
  results.push(await assertStatus(
    "J2.1 POST /api/sessions/batch with empty body → 401 (auth before validation)",
    "/api/sessions/batch",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) },
    401
  ));

  // J3: Job process endpoint - missing jobId → 400
  results.push(await assertStatus(
    "J3.1 POST /api/jobs/process with missing jobId → 400",
    "/api/jobs/process",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) },
    400
  ));

  // J4: Method not allowed checks
  results.push(await assertStatus(
    "J4.1 GET /api/sessions/batch → 405 (wrong method)",
    "/api/sessions/batch",
    { method: "GET" },
    405
  ));

  results.push(await assertStatus(
    "J4.2 GET /api/jobs/process → 405 (wrong method)",
    "/api/jobs/process",
    { method: "GET" },
    405
  ));

  // Print results
  let passed = 0;
  let failed = 0;

  for (const r of results) {
    const icon = r.status === "PASS" ? "✅" : "❌";
    console.log(`${icon} ${r.name}`);
    console.log(`   ${r.details}\n`);
    if (r.status === "PASS") passed++; else failed++;
  }

  console.log(`\n=== Results: ${passed}/${results.length} PASS, ${failed} FAIL ===`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
