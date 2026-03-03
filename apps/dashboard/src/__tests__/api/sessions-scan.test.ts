import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock("@sessionforge/db", () => ({
  workspaces: {},
  claudeSessions: {},
  users: {},
  authSessions: {},
  accounts: {},
  verifications: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
}));

vi.mock("@/lib/sessions/scanner", () => ({
  scanSessionFiles: vi.fn(),
}));

vi.mock("@/lib/sessions/parser", () => ({
  parseSessionFile: vi.fn(),
}));

vi.mock("@/lib/sessions/normalizer", () => ({
  normalizeSession: vi.fn(),
}));

vi.mock("@/lib/sessions/indexer", () => ({
  indexSessions: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { scanSessionFiles } from "@/lib/sessions/scanner";
import { parseSessionFile } from "@/lib/sessions/parser";
import { normalizeSession } from "@/lib/sessions/normalizer";
import { indexSessions } from "@/lib/sessions/indexer";
import { POST } from "@/app/api/sessions/scan/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupDbSelectMock(result: unknown[]) {
  const mockLimit = vi.fn().mockResolvedValue(result);
  const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
  vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);
  return { mockFrom, mockWhere, mockLimit };
}

function makeRequest(body?: unknown): NextRequest {
  const bodyStr = body !== undefined ? JSON.stringify(body) : undefined;
  return new NextRequest("http://localhost/api/sessions/scan", {
    method: "POST",
    body: bodyStr,
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_SESSION = {
  user: { id: "user-123", name: "Test User", email: "test@example.com" },
  session: { id: "session-abc" },
};

const MOCK_WORKSPACE = {
  id: "ws-456",
  ownerId: "user-123",
  sessionBasePath: "/home/test/.claude",
};

const MOCK_FILE_META = {
  sessionId: "sess-1",
  filePath: "/home/test/.claude/projects/-home-test-repo/sessions/sess-1.jsonl",
  projectPath: "/home/test/repo",
  mtime: new Date("2024-01-15T10:00:00Z"),
};

const MOCK_PARSED = {
  messageCount: 8,
  toolsUsed: ["Write", "Edit"],
  filesModified: ["src/index.ts"],
  errorsEncountered: [],
  costUsd: 0.025,
  startedAt: new Date("2024-01-15T09:55:00Z"),
  endedAt: new Date("2024-01-15T10:00:00Z"),
};

const MOCK_NORMALIZED = {
  sessionId: "sess-1",
  projectPath: "/home/test/repo",
  projectName: "repo",
  filePath: MOCK_FILE_META.filePath,
  messageCount: 8,
  toolsUsed: ["Write", "Edit"],
  filesModified: ["src/index.ts"],
  errorsEncountered: [],
  costUsd: 0.025,
  startedAt: new Date("2024-01-15T09:55:00Z"),
  endedAt: new Date("2024-01-15T10:00:00Z"),
  durationSeconds: 300,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/sessions/scan", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("authentication", () => {
    it("returns 401 when no session exists", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      const res = await POST(makeRequest());

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toEqual({ error: "Unauthorized" });
    });

    it("does not query the database when unauthenticated", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(null);

      await POST(makeRequest());

      expect(db.select).not.toHaveBeenCalled();
    });
  });

  describe("workspace lookup", () => {
    it("returns 404 when no workspace exists for the user", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(MOCK_SESSION as any);
      setupDbSelectMock([]);

      const res = await POST(makeRequest());

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toEqual({ error: "No workspace found" });
    });

    it("does not scan files when no workspace exists", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(MOCK_SESSION as any);
      setupDbSelectMock([]);

      await POST(makeRequest());

      expect(scanSessionFiles).not.toHaveBeenCalled();
    });
  });

  describe("successful scan", () => {
    beforeEach(() => {
      vi.mocked(auth.api.getSession).mockResolvedValue(MOCK_SESSION as any);
      setupDbSelectMock([MOCK_WORKSPACE]);
    });

    it("returns 200 with correct response shape", async () => {
      vi.mocked(scanSessionFiles).mockResolvedValue([MOCK_FILE_META] as any);
      vi.mocked(parseSessionFile).mockResolvedValue(MOCK_PARSED as any);
      vi.mocked(normalizeSession).mockReturnValue(MOCK_NORMALIZED as any);
      vi.mocked(indexSessions).mockResolvedValue({ scanned: 1, indexed: 1, errors: [] });

      const res = await POST(makeRequest({}));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        scanned: 1,
        indexed: 1,
        errors: [],
      });
      expect(typeof body.durationMs).toBe("number");
      expect(body.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("uses default lookbackDays of 30 when not provided in body", async () => {
      vi.mocked(scanSessionFiles).mockResolvedValue([]);
      vi.mocked(indexSessions).mockResolvedValue({ scanned: 0, indexed: 0, errors: [] });

      await POST(makeRequest({}));

      expect(scanSessionFiles).toHaveBeenCalledWith(30, MOCK_WORKSPACE.sessionBasePath);
    });

    it("uses provided lookbackDays when given a number", async () => {
      vi.mocked(scanSessionFiles).mockResolvedValue([]);
      vi.mocked(indexSessions).mockResolvedValue({ scanned: 0, indexed: 0, errors: [] });

      await POST(makeRequest({ lookbackDays: 7 }));

      expect(scanSessionFiles).toHaveBeenCalledWith(7, MOCK_WORKSPACE.sessionBasePath);
    });

    it("defaults lookbackDays to 30 when lookbackDays is a string", async () => {
      vi.mocked(scanSessionFiles).mockResolvedValue([]);
      vi.mocked(indexSessions).mockResolvedValue({ scanned: 0, indexed: 0, errors: [] });

      await POST(makeRequest({ lookbackDays: "thirty" }));

      expect(scanSessionFiles).toHaveBeenCalledWith(30, MOCK_WORKSPACE.sessionBasePath);
    });

    it("defaults lookbackDays to 30 when body is invalid JSON", async () => {
      vi.mocked(scanSessionFiles).mockResolvedValue([]);
      vi.mocked(indexSessions).mockResolvedValue({ scanned: 0, indexed: 0, errors: [] });

      const req = new NextRequest("http://localhost/api/sessions/scan", {
        method: "POST",
        body: "not-valid-json",
        headers: { "Content-Type": "application/json" },
      });

      await POST(req);

      expect(scanSessionFiles).toHaveBeenCalledWith(30, MOCK_WORKSPACE.sessionBasePath);
    });

    it("falls back to ~/.claude when workspace has no sessionBasePath", async () => {
      const workspaceNoPath = { ...MOCK_WORKSPACE, sessionBasePath: null };
      setupDbSelectMock([workspaceNoPath]);

      vi.mocked(scanSessionFiles).mockResolvedValue([]);
      vi.mocked(indexSessions).mockResolvedValue({ scanned: 0, indexed: 0, errors: [] });

      await POST(makeRequest({}));

      expect(scanSessionFiles).toHaveBeenCalledWith(30, "~/.claude");
    });

    it("passes workspace id to indexSessions", async () => {
      vi.mocked(scanSessionFiles).mockResolvedValue([MOCK_FILE_META] as any);
      vi.mocked(parseSessionFile).mockResolvedValue(MOCK_PARSED as any);
      vi.mocked(normalizeSession).mockReturnValue(MOCK_NORMALIZED as any);
      vi.mocked(indexSessions).mockResolvedValue({ scanned: 1, indexed: 1, errors: [] });

      await POST(makeRequest({}));

      expect(indexSessions).toHaveBeenCalledWith(
        MOCK_WORKSPACE.id,
        [MOCK_NORMALIZED]
      );
    });

    it("calls parseSessionFile for each scanned file", async () => {
      const meta1 = { ...MOCK_FILE_META, sessionId: "s1", filePath: "/p/s1.jsonl" };
      const meta2 = { ...MOCK_FILE_META, sessionId: "s2", filePath: "/p/s2.jsonl" };

      vi.mocked(scanSessionFiles).mockResolvedValue([meta1, meta2] as any);
      vi.mocked(parseSessionFile).mockResolvedValue(MOCK_PARSED as any);
      vi.mocked(normalizeSession).mockReturnValue(MOCK_NORMALIZED as any);
      vi.mocked(indexSessions).mockResolvedValue({ scanned: 2, indexed: 2, errors: [] });

      await POST(makeRequest({}));

      expect(parseSessionFile).toHaveBeenCalledTimes(2);
      expect(parseSessionFile).toHaveBeenCalledWith(meta1.filePath);
      expect(parseSessionFile).toHaveBeenCalledWith(meta2.filePath);
    });

    it("calls normalizeSession for each scanned file with meta and parsed data", async () => {
      vi.mocked(scanSessionFiles).mockResolvedValue([MOCK_FILE_META] as any);
      vi.mocked(parseSessionFile).mockResolvedValue(MOCK_PARSED as any);
      vi.mocked(normalizeSession).mockReturnValue(MOCK_NORMALIZED as any);
      vi.mocked(indexSessions).mockResolvedValue({ scanned: 1, indexed: 1, errors: [] });

      await POST(makeRequest({}));

      expect(normalizeSession).toHaveBeenCalledWith(MOCK_FILE_META, MOCK_PARSED);
    });

    it("includes error messages from indexSessions in the response", async () => {
      const errors = ["Failed to index session bad-sess: timeout error"];

      vi.mocked(scanSessionFiles).mockResolvedValue([]);
      vi.mocked(indexSessions).mockResolvedValue({ scanned: 0, indexed: 0, errors });

      const res = await POST(makeRequest({}));
      const body = await res.json();

      expect(body.errors).toEqual(errors);
    });

    it("returns zero scanned and indexed when no files found", async () => {
      vi.mocked(scanSessionFiles).mockResolvedValue([]);
      vi.mocked(indexSessions).mockResolvedValue({ scanned: 0, indexed: 0, errors: [] });

      const res = await POST(makeRequest({}));
      const body = await res.json();

      expect(body.scanned).toBe(0);
      expect(body.indexed).toBe(0);
      expect(body.errors).toEqual([]);
    });
  });
});
