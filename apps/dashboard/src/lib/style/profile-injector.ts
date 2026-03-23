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

  // ── Tone attributes (with user overrides taking precedence) ───────────────
  if (profile.toneAttributes) {
    const attrs = profile.toneAttributes;
    const formalityScore = profile.formalityOverride ?? attrs.formality;
    const technicalScore = profile.technicalDepthOverride ?? attrs.technicalDepth;
    const humorScore = profile.humorOverride ?? attrs.humor;

    if (formalityScore != null) {
      lines.push(`Tone: ${scoreToLabel(formalityScore, "informal and conversational", "balanced (neither stiff nor overly casual)", "formal and precise")}.`);
    }
    if (technicalScore != null) {
      lines.push(`Technical depth: ${scoreToLabel(technicalScore, "high-level and accessible", "moderately technical", "deeply technical with implementation details")}.`);
    }
    if (humorScore != null) {
      lines.push(`Humor: ${scoreToLabel(humorScore, "serious and straightforward", "occasionally light-hearted", "frequently witty and humorous")}.`);
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

  // ── Vocabulary fingerprint ─────────────────────────────────────────────────
  if (profile.vocabularyFingerprint && profile.vocabularyFingerprint.length > 0) {
    lines.push(
      `Vocabulary fingerprint (characteristic words and phrases to favour):\n${profile.vocabularyFingerprint.map((w) => `- ${w}`).join("\n")}`
    );
  }

  // ── Anti-AI patterns ──────────────────────────────────────────────────────
  if (profile.antiAiPatterns && profile.antiAiPatterns.length > 0) {
    lines.push(
      `Anti-AI patterns (phrases and constructs to actively avoid):\n${profile.antiAiPatterns.map((p) => `- ${p}`).join("\n")}`
    );
  }

  // ── Authentic voice strategies ────────────────────────────────────────────
  lines.push(
    [
      "Authentic voice strategies:",
      "- Natural variation: vary sentence length, rhythm, and structure rather than producing uniform output.",
      "- Concrete specificity: prefer precise details and real examples over vague generalities or filler phrases.",
    ].join("\n")
  );

  // ── Example excerpts ──────────────────────────────────────────────────────
  if (profile.exampleExcerpts && profile.exampleExcerpts.length > 0) {
    const samples = profile.exampleExcerpts.slice(0, 3);
    lines.push(`Style examples (reference only):\n${samples.map((e, i) => `${i + 1}. ${e}`).join("\n")}`);
  }

  // ── Custom instructions ───────────────────────────────────────────────────
  if (profile.customInstructions) {
    lines.push(`Additional instructions: ${profile.customInstructions}`);
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
