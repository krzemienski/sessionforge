import { db } from "@/lib/db";
import { posts, riskFlagResolutions } from "@sessionforge/db";
import { eq, and } from "drizzle-orm";
import type { RiskFlag } from "@sessionforge/db";
import { ClaimExtractor } from "@/lib/verification/claim-extractor";
import { RiskScorer } from "@/lib/verification/risk-scorer";
import type { VerificationSummary, VerificationResult } from "@/lib/verification/types";

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildVerificationSummary(flags: RiskFlag[]): VerificationSummary {
  const unresolvedCount = flags.filter((f) => f.status === "unresolved").length;
  const criticalCount = flags.filter((f) => f.severity === "critical").length;
  const highCount = flags.filter((f) => f.severity === "high").length;
  const mediumCount = flags.filter((f) => f.severity === "medium").length;
  const lowCount = flags.filter((f) => f.severity === "low").length;
  const infoCount = flags.filter((f) => f.severity === "info").length;

  let verificationStatus: VerificationSummary["verificationStatus"] = "verified";
  if (criticalCount > 0 || highCount > 0) {
    verificationStatus = unresolvedCount > 0 ? "has_issues" : "verified";
  } else if (unresolvedCount > 0) {
    verificationStatus = "has_issues";
  }

  return {
    totalFlags: flags.length,
    unresolvedCount,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    infoCount,
    verificationStatus,
  };
}

// ── Tool implementations ────────────────────────────────────────────────────

/**
 * Run claim extraction and risk scoring on a post's markdown content.
 * Updates the post's verificationStatus and riskFlags in the database.
 */
export async function verifyClaims(
  workspaceId: string,
  postId: string
): Promise<VerificationResult> {
  const post = await db.query.posts.findFirst({
    where: and(eq(posts.id, postId), eq(posts.workspaceId, workspaceId)),
  });

  if (!post) {
    throw new Error(`Post ${postId} not found`);
  }

  // Extract claims from markdown
  const extractor = new ClaimExtractor();
  const claims = extractor.extract(post.markdown);

  // Build evidence context from post citations
  const citations = (post.citations as { sessionId: string; messageIndex: number; text: string; type: string }[]) ?? [];
  const evidenceContext = {
    citations: [] as { url: string; title: string; snippet?: string }[],
    sessions: citations.map((c) => ({
      sessionId: c.sessionId,
      messageIndex: c.messageIndex,
      text: c.text,
    })),
    insights: [] as { insightId: string; text: string }[],
  };

  // Score claims against evidence
  const scorer = new RiskScorer();
  const flags = scorer.score(claims, evidenceContext);

  // Determine overall verification status
  const summary = buildVerificationSummary(flags);

  // Persist flags and status to the post
  await db
    .update(posts)
    .set({
      riskFlags: flags,
      verificationStatus: summary.verificationStatus,
    })
    .where(and(eq(posts.id, postId), eq(posts.workspaceId, workspaceId)));

  return {
    postId,
    verifiedAt: new Date().toISOString(),
    status: summary.verificationStatus,
    flags,
    summary,
  };
}

/**
 * Fetch stored risk flags for a post.
 */
export async function getRiskFlags(
  workspaceId: string,
  postId: string
): Promise<{ postId: string; flags: RiskFlag[]; verificationStatus: string }> {
  const post = await db.query.posts.findFirst({
    where: and(eq(posts.id, postId), eq(posts.workspaceId, workspaceId)),
    columns: {
      id: true,
      riskFlags: true,
      verificationStatus: true,
    },
  });

  if (!post) {
    throw new Error(`Post ${postId} not found`);
  }

  return {
    postId: post.id,
    flags: (post.riskFlags as RiskFlag[]) ?? [],
    verificationStatus: post.verificationStatus ?? "unverified",
  };
}

/**
 * Resolve a risk flag by marking it as verified or dismissed with optional evidence notes.
 * Updates both the post's riskFlags JSON and creates a resolution record.
 */
export async function resolveRiskFlag(
  workspaceId: string,
  postId: string,
  flagId: string,
  resolution: "verified" | "dismissed",
  resolvedBy: string,
  evidenceNotes?: string
): Promise<{ flagId: string; status: string; resolvedAt: string }> {
  const post = await db.query.posts.findFirst({
    where: and(eq(posts.id, postId), eq(posts.workspaceId, workspaceId)),
    columns: {
      id: true,
      riskFlags: true,
    },
  });

  if (!post) {
    throw new Error(`Post ${postId} not found`);
  }

  const flags = ((post.riskFlags as RiskFlag[]) ?? []).slice();
  const flagIndex = flags.findIndex((f) => f.id === flagId);

  if (flagIndex === -1) {
    throw new Error(`Risk flag ${flagId} not found on post ${postId}`);
  }

  const now = new Date().toISOString();

  // Update the flag in the JSON array
  flags[flagIndex] = {
    ...flags[flagIndex],
    status: resolution,
    resolvedBy,
    resolvedAt: now,
  };

  // Recompute verification status
  const summary = buildVerificationSummary(flags);

  // Persist updated flags and status
  await db
    .update(posts)
    .set({
      riskFlags: flags,
      verificationStatus: summary.verificationStatus,
    })
    .where(and(eq(posts.id, postId), eq(posts.workspaceId, workspaceId)));

  // Create a resolution record
  await db.insert(riskFlagResolutions).values({
    postId,
    flagId,
    status: resolution,
    resolvedBy,
    evidenceNotes: evidenceNotes ?? null,
  });

  return {
    flagId,
    status: resolution,
    resolvedAt: now,
  };
}

/**
 * Get aggregate verification statistics for a post.
 */
export async function getVerificationSummary(
  workspaceId: string,
  postId: string
): Promise<VerificationSummary & { postId: string }> {
  const post = await db.query.posts.findFirst({
    where: and(eq(posts.id, postId), eq(posts.workspaceId, workspaceId)),
    columns: {
      id: true,
      riskFlags: true,
      verificationStatus: true,
    },
  });

  if (!post) {
    throw new Error(`Post ${postId} not found`);
  }

  const flags = (post.riskFlags as RiskFlag[]) ?? [];
  const summary = buildVerificationSummary(flags);

  return {
    postId: post.id,
    ...summary,
  };
}

// ── MCP tool definitions ────────────────────────────────────────────────────

export const verificationTools = [
  {
    name: "verify_claims",
    description:
      "Run claim extraction and risk scoring on a post. Analyzes the markdown content for factual claims, scores them against available evidence, and stores the resulting risk flags.",
    input_schema: {
      type: "object" as const,
      properties: {
        postId: {
          type: "string",
          description: "The post ID to verify",
        },
      },
      required: ["postId"],
    },
  },
  {
    name: "get_risk_flags",
    description:
      "Fetch stored risk flags for a post. Returns all flags with their severity, category, evidence, and resolution status.",
    input_schema: {
      type: "object" as const,
      properties: {
        postId: {
          type: "string",
          description: "The post ID to get risk flags for",
        },
      },
      required: ["postId"],
    },
  },
  {
    name: "resolve_risk_flag",
    description:
      "Mark a risk flag as verified or dismissed with optional evidence notes. Updates the flag status and creates a resolution record.",
    input_schema: {
      type: "object" as const,
      properties: {
        postId: {
          type: "string",
          description: "The post ID containing the flag",
        },
        flagId: {
          type: "string",
          description: "The ID of the risk flag to resolve",
        },
        resolution: {
          type: "string",
          enum: ["verified", "dismissed"],
          description: "Resolution status: 'verified' (claim confirmed) or 'dismissed' (flag not applicable)",
        },
        resolvedBy: {
          type: "string",
          description: "User ID of the person resolving the flag",
        },
        evidenceNotes: {
          type: "string",
          description: "Optional notes or evidence supporting the resolution",
        },
      },
      required: ["postId", "flagId", "resolution", "resolvedBy"],
    },
  },
  {
    name: "get_verification_summary",
    description:
      "Get aggregate verification statistics for a post including flag counts by severity, unresolved count, and overall verification status.",
    input_schema: {
      type: "object" as const,
      properties: {
        postId: {
          type: "string",
          description: "The post ID to get verification summary for",
        },
      },
      required: ["postId"],
    },
  },
];

// ── Handler ─────────────────────────────────────────────────────────────────

export async function handleVerificationTool(
  workspaceId: string,
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<unknown> {
  switch (toolName) {
    case "verify_claims":
      return verifyClaims(workspaceId, toolInput.postId as string);
    case "get_risk_flags":
      return getRiskFlags(workspaceId, toolInput.postId as string);
    case "resolve_risk_flag":
      return resolveRiskFlag(
        workspaceId,
        toolInput.postId as string,
        toolInput.flagId as string,
        toolInput.resolution as "verified" | "dismissed",
        toolInput.resolvedBy as string,
        toolInput.evidenceNotes as string | undefined
      );
    case "get_verification_summary":
      return getVerificationSummary(workspaceId, toolInput.postId as string);
    default:
      throw new Error(`Unknown verification tool: ${toolName}`);
  }
}
