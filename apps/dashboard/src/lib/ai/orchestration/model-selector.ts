import type { AgentType } from "./tool-registry";

const OPUS_AGENTS: AgentType[] = [
  "insight-extractor",
  "blog-writer",
  "social-writer",
  "changelog-writer",
  "editor-chat",
  "repurpose-writer",
];

const HAIKU_MODEL = "claude-haiku-4-5-20251001";
const OPUS_MODEL = "claude-opus-4-6";
const SONNET_MODEL = "claude-sonnet-4-6";

export function getModelForAgent(agentType: AgentType): string {
  if (OPUS_AGENTS.includes(agentType)) return OPUS_MODEL;
  return SONNET_MODEL;
}

export function getHaikuModel(): string {
  return HAIKU_MODEL;
}

export function getSonnetModel(): string {
  return SONNET_MODEL;
}

export function getOpusModel(): string {
  return OPUS_MODEL;
}
