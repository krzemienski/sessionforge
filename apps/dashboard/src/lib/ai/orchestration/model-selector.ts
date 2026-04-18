/**
 * Model selector for AI agents.
 * Centralises Claude model name constants and maps each agent type to the
 * appropriate model variant based on task complexity.
 */

import type { AgentType } from "./tool-registry";

/**
 * Agents that use the Opus model.
 * All current agents use Opus for maximum quality, but this list
 * allows selective downgrade to Sonnet or Haiku in future.
 */
const OPUS_AGENTS: AgentType[] = [
  "insight-extractor",
  "corpus-analyzer",
  "blog-writer",
  "social-writer",
  "changelog-writer",
  "editor-chat",
  "repurpose-writer",
  "newsletter-writer",
  "claim-verifier",
];

/** Claude Haiku model identifier — used for fast, lightweight tasks. */
const HAIKU_MODEL = "claude-haiku-4-5-20251001";

/** Claude Opus model identifier — used for high-quality creative and analytical work. */
const OPUS_MODEL = "claude-opus-4-7";

/** Claude Sonnet model identifier — used as the default fallback model. */
const SONNET_MODEL = "claude-sonnet-4-6";

/**
 * Returns the recommended Claude model for the given agent type.
 *
 * Agents listed in `OPUS_AGENTS` receive the Opus model for maximum
 * capability; all others fall back to Sonnet.
 *
 * @param agentType - The agent whose model should be resolved.
 * @returns The Claude model identifier string to pass to the Anthropic SDK.
 */
export function getModelForAgent(agentType: AgentType): string {
  if (OPUS_AGENTS.includes(agentType)) return OPUS_MODEL;
  return SONNET_MODEL;
}

/**
 * Returns the Claude Haiku model identifier.
 * Suitable for fast, cheap inference where quality requirements are lower.
 *
 * @returns The Haiku model identifier string.
 */
export function getHaikuModel(): string {
  return HAIKU_MODEL;
}

/**
 * Returns the Claude Sonnet model identifier.
 * A balanced model for tasks that need moderate capability at reasonable cost.
 *
 * @returns The Sonnet model identifier string.
 */
export function getSonnetModel(): string {
  return SONNET_MODEL;
}

/**
 * Returns the Claude Opus model identifier.
 * The most capable model, used for high-quality writing and complex analysis.
 *
 * @returns The Opus model identifier string.
 */
export function getOpusModel(): string {
  return OPUS_MODEL;
}
