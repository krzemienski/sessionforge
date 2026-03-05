/**
 * Agent type registry.
 * Defines the canonical set of agent identifiers used across the system.
 * Tool-to-agent mapping lives in mcp-server-factory.ts (single source of truth).
 */

/** Union of all recognised agent identifiers in the system. */
export type AgentType =
  | "insight-extractor"
  | "blog-writer"
  | "social-writer"
  | "changelog-writer"
  | "editor-chat"
  | "repurpose-writer"
  | "newsletter-writer"
  | "evidence-writer"
  | "supplementary-writer";
