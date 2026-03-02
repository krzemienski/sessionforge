import { db } from "@/lib/db";
import { writingStyleProfiles } from "@sessionforge/db";
import { eq } from "drizzle-orm";

type WritingStyleProfile = typeof writingStyleProfiles.$inferSelect;

/**
 * Maps a 0–1 score to a descriptive label at three breakpoints.
 */
function scoreToLabel(
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
function formatProfileAsText(profile: WritingStyleProfile): string | null {
  if (profile.generationStatus !== "completed") return null;

  const lines: string[] = [];

  // ── Tone & depth ──────────────────────────────────────────────────────────
  const formalityLabel = scoreToLabel(
    profile.formality,
    "informal and conversational",
    "balanced (neither stiff nor overly casual)",
    "formal and precise"
  );
  const depthLabel = scoreToLabel(
    profile.technicalDepth,
    "high-level and accessible",
    "moderately technical",
    "deeply technical with implementation details"
  );
  const humorLabel = scoreToLabel(
    profile.humor,
    "serious and straightforward",
    "occasionally light-hearted",
    "frequently witty and humorous"
  );

  lines.push(`Tone: ${formalityLabel}.`);
  lines.push(`Technical depth: ${depthLabel}.`);
  lines.push(`Humor: ${humorLabel}.`);

  // ── Heading conventions ───────────────────────────────────────────────────
  if (profile.headingStyle) {
    const { capitalization, includeEmoji, preferredLevels } =
      profile.headingStyle;

    const capLabel =
      capitalization === "title"
        ? "Title Case"
        : capitalization === "all_caps"
          ? "ALL CAPS"
          : "Sentence case";

    const levelsLabel =
      preferredLevels && preferredLevels.length > 0
        ? preferredLevels.join(", ")
        : "h2, h3";

    const emojiNote = includeEmoji
      ? " Emoji in headings are welcome."
      : " Avoid emoji in headings.";

    lines.push(
      `Headings: use ${capLabel}, preferred levels ${levelsLabel}.${emojiNote}`
    );
  }

  // ── Code explanation style ────────────────────────────────────────────────
  if (profile.codeStyle) {
    const { commentDensity, preferInlineComments, explanationStyle } =
      profile.codeStyle;

    const explanationNote =
      explanationStyle === "before"
        ? "Explain code blocks before showing them."
        : explanationStyle === "after"
          ? "Explain code blocks after showing them."
          : "Prefer inline code comments over separate paragraphs.";

    lines.push(
      `Code style: ${commentDensity} comments, ${preferInlineComments ? "inline" : "block"} comment style. ${explanationNote}`
    );
  }

  // ── Vocabulary & sentence patterns ────────────────────────────────────────
  if (profile.vocabularyPatterns && profile.vocabularyPatterns.length > 0) {
    lines.push(
      `Writing patterns to adopt:\n${profile.vocabularyPatterns.map((p) => `- ${p}`).join("\n")}`
    );
  }

  // ── Representative edits ─────────────────────────────────────────────────
  if (profile.sampleEdits && profile.sampleEdits.length > 0) {
    const samples = profile.sampleEdits.slice(0, 3);
    const editLines = samples
      .map(
        (e, i) =>
          `Example ${i + 1}:\n  Before: ${e.original}\n  After:  ${e.edited}`
      )
      .join("\n");
    lines.push(`Sample style edits (reference only, do not reproduce):\n${editLines}`);
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  if (profile.publishedPostsAnalyzed && profile.publishedPostsAnalyzed > 0) {
    lines.push(
      `(Profile derived from ${profile.publishedPostsAnalyzed} published posts.)`
    );
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
