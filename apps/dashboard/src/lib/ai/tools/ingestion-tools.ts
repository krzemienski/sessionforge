/**
 * Ingestion MCP tools — expose Phase 3 source material to agents.
 *
 * Source material is injected into the tool handler closure via
 * setSourceMaterial() before the agent run begins. Agents then call
 * these tools to access the pre-assembled package.
 *
 * Tools:
 *  - get_source_material: return full SourceMaterialPackage summary
 *  - get_external_source: full parsed URL content by index
 *  - get_repo_analysis: full repo summary by index
 *  - get_content_brief: structured user text brief
 */

import type { SourceMaterialPackage } from "@/lib/ingestion/source-assembler";

// ── Per-workspace source material context ──────────────────────────────────

// Source material is set before the agent run and accessed during tool calls.
// Keyed by workspaceId to support concurrent requests.
const sourceMaterialStore = new Map<string, SourceMaterialPackage>();

/** Set source material for a workspace before the agent run. */
export function setSourceMaterial(
  workspaceId: string,
  pkg: SourceMaterialPackage
): void {
  sourceMaterialStore.set(workspaceId, pkg);
}

/** Clear source material after the agent run completes. */
export function clearSourceMaterial(workspaceId: string): void {
  sourceMaterialStore.delete(workspaceId);
}

// ── Tool implementations ───────────────────────────────────────────────────

function getSourceMaterial(workspaceId: string) {
  const pkg = sourceMaterialStore.get(workspaceId);
  if (!pkg) {
    return {
      available: false,
      message: "No source material loaded. Proceed with session evidence only.",
    };
  }

  return {
    available: true,
    assembledAt: pkg.assembledAt,
    userBrief: pkg.userBrief
      ? {
          thesis: pkg.userBrief.thesis,
          keyPoints: pkg.userBrief.keyPoints,
          tone: pkg.userBrief.tone,
          audience: pkg.userBrief.audience,
          impliedQuestions: pkg.userBrief.impliedQuestions,
          referencedConcepts: pkg.userBrief.referencedConcepts,
        }
      : null,
    externalSourceCount: pkg.externalSources.length,
    repositoryCount: pkg.repositories.length,
    sessionEvidenceCount: pkg.sessionEvidence.length,
    crossReferenceCount: pkg.crossReferences.length,
    crossReferences: pkg.crossReferences,
    externalSourceTitles: pkg.externalSources.map((s, i) => ({
      index: i,
      title: s.title,
      url: s.url,
      excerpt: s.excerpt.slice(0, 200),
    })),
    repositoryNames: pkg.repositories.map((r, i) => ({
      index: i,
      name: r.name,
      description: r.description,
      techStack: r.techStack,
    })),
  };
}

function getExternalSource(workspaceId: string, index: number) {
  const pkg = sourceMaterialStore.get(workspaceId);
  if (!pkg) {
    throw new Error("No source material loaded");
  }
  const source = pkg.externalSources[index];
  if (!source) {
    throw new Error(`No external source at index ${index}. Available: ${pkg.externalSources.length}`);
  }
  return source;
}

function getRepoAnalysis(workspaceId: string, index: number) {
  const pkg = sourceMaterialStore.get(workspaceId);
  if (!pkg) {
    throw new Error("No source material loaded");
  }
  const repo = pkg.repositories[index];
  if (!repo) {
    throw new Error(`No repository at index ${index}. Available: ${pkg.repositories.length}`);
  }
  return repo;
}

function getContentBrief(workspaceId: string) {
  const pkg = sourceMaterialStore.get(workspaceId);
  if (!pkg) {
    return { available: false, brief: null };
  }
  return { available: !!pkg.userBrief, brief: pkg.userBrief };
}

// ── Router ─────────────────────────────────────────────────────────────────

export async function handleIngestionTool(
  workspaceId: string,
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<unknown> {
  switch (toolName) {
    case "get_source_material":
      return getSourceMaterial(workspaceId);

    case "get_external_source":
      return getExternalSource(workspaceId, toolInput.index as number);

    case "get_repo_analysis":
      return getRepoAnalysis(workspaceId, toolInput.index as number);

    case "get_content_brief":
      return getContentBrief(workspaceId);

    default:
      throw new Error(`Unknown ingestion tool: ${toolName}`);
  }
}
