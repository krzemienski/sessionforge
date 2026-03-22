import { db } from "@/lib/db";
import { writingStyleProfiles } from "@sessionforge/db";
import { eq } from "drizzle-orm/sql";

type WritingStyleProfile = typeof writingStyleProfiles.$inferSelect;

/**
 * Maps a 0–1 score to a descriptive label at three breakpoints.
 */
export function scoreToLabel(
  score: number | null | undefined,
  low: string,
  mid: string,
  high: string
): string {
  if (score == null) return mid;
  if (score < 0.35) return low;
  if (score < 0.65) return mid;
  return high;
}

/**
 * Converts a WritingStyleProfile record into a human-readable voice-guide
 * paragraph suitable for injection into an AI system prompt.
 *
 * Returns null if the profile is not in a completed state.
 */
export function formatProfileAsText(profile: WritingStyleProfile): string | null {
  if (profile.generationStatus !== "completed") return null;

  const lines: string[] = [];

  // ── Tone attributes ────────────────────────────────────────────────────────
  if (profile.toneAttributes) {
    const attrs = profile.toneAttributes;
    if (attrs.formality != null) {
      lines.push(`Tone: ${scoreToLabel(attrs.formality, "informal and conversational", "balanced (neither stiff nor overly casual)", "formal and precise")}.`);
    }
    if (attrs.technicalDepth != null) {
      lines.push(`Technical depth: ${scoreToLabel(attrs.technicalDepth, "high-level and accessible", "moderately technical", "deeply technical with implementation details")}.`);
    }
    if (attrs.humor != null) {
      lines.push(`Humor: ${scoreToLabel(attrs.humor, "serious and straightforward", "occasionally light-hearted", "frequently witty and humorous")}.`);
    }
  }

  // ── Voice characteristics ──────────────────────────────────────────────────
  if (profile.voiceCharacteristics && profile.voiceCharacteristics.length > 0) {
    lines.push(
      `Voice characteristics:\n${profile.voiceCharacteristics.map((c) => `- ${c}`).join("\n")}`
    );
  }

  // ── Vocabulary & sentence structure ────────────────────────────────────────
  if (profile.vocabularyLevel) {
    lines.push(`Vocabulary level: ${profile.vocabularyLevel}.`);
  }
  if (profile.sentenceStructure) {
    lines.push(`Sentence structure: ${profile.sentenceStructure}.`);
  }

  // ── Example excerpts ──────────────────────────────────────────────────────
  if (profile.exampleExcerpts && profile.exampleExcerpts.length > 0) {
    const samples = profile.exampleExcerpts.slice(0, 3);
    lines.push(`Style examples (reference only):\n${samples.map((e, i) => `${i + 1}. ${e}`).join("\n")}`);
  }

  return lines.join("\n\n");
}

/**
 * Fetches the writing style profile for a workspace and formats it as
 * voice-guide text.
 *
 * Returns null if no completed profile exists.
 */
export async function getStyleProfileContext(
  workspaceId: string
): Promise<string | null> {
  const rows = await db
    .select()
    .from(writingStyleProfiles)
    .where(eq(writingStyleProfiles.workspaceId, workspaceId))
    .limit(1);

  if (rows.length === 0) return null;

  return formatProfileAsText(rows[0]);
}

/**
 * Appends a VOICE GUIDE section to `basePrompt` using the workspace's
 * writing style profile.
 *
 * If no completed profile exists the original prompt is returned unchanged.
 */
export async function injectStyleProfile(
  basePrompt: string,
  workspaceId: string
): Promise<string> {
  const context = await getStyleProfileContext(workspaceId);
  if (!context) return basePrompt;

  return `${basePrompt}\n\nVOICE GUIDE:\n${context}`;
}
