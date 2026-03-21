/**
 * Voice calibration wizard agent that analyzes raw writing samples (not AI draft diffs)
 * to build a baseline voice profile. Uses the Agent SDK for text generation
 * (no tools needed — pure analysis of author-written samples).
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import { instrumentQuery } from "@/lib/observability/instrument-query";

delete process.env.CLAUDECODE;

import { db } from "@/lib/db";
import { writingStyleProfiles } from "@sessionforge/db";
import { VOICE_CALIBRATION_PROMPT } from "../prompts/style-learner";
import { getOpusModel } from "../orchestration/model-selector";

export type WritingStyleProfile = typeof writingStyleProfiles.$inferSelect;

const MIN_SAMPLES_REQUIRED = 3;
const MAX_SAMPLES_ALLOWED = 5;

interface VocabularyFingerprint {
  signatureWords: string[];
  avoidedWords: string[];
  transitionalStyle: string;
  intensifiersAndQualifiers: string[];
}

interface AuthenticityMarker {
  marker: string;
  evidence: string;
}

interface RepresentativePassage {
  passage: string;
  voiceNote: string;
}

interface VoiceCalibrationResponse {
  formalityScore: number;
  technicalDepth: number;
  humorScore: number;
  headingStyle: "sentence_case" | "title_case" | "unknown";
  sentenceRhythm: string;
  openingPattern: string;
  closingPattern: string;
  vocabularyFingerprint: VocabularyFingerprint;
  punctuationPersonality: string;
  authenticityMarkers: AuthenticityMarker[];
  representativePassages: RepresentativePassage[];
  vocabularyNotes: string;
  sentenceStructureNotes: string;
}

/**
 * Analyzes an array of raw writing samples to produce a calibrated voice profile.
 *
 * @param workspaceId - The workspace to upsert the profile into.
 * @param samples - Array of 3–5 writing samples authored directly by the user.
 * @returns The upserted WritingStyleProfile, or null if insufficient samples or parsing fails.
 */
export async function calibrateVoiceFromSamples(
  workspaceId: string,
  samples: string[],
): Promise<WritingStyleProfile | null> {
  // 1. Validate sample count
  if (
    samples.length < MIN_SAMPLES_REQUIRED ||
    samples.length > MAX_SAMPLES_ALLOWED
  ) {
    return null;
  }

  // 2. Build the content payload for Claude
  const samplesContent = samples
    .map((sample, i) => {
      return [
        `## Writing Sample ${i + 1}`,
        ``,
        sample.trim(),
        ``,
        `---`,
      ].join("\n");
    })
    .join("\n\n");

  const userMessage = `Analyze the following ${samples.length} writing sample${samples.length > 1 ? "s" : ""} to extract an authentic voice fingerprint for this author.\n\n${samplesContent}`;

  // 3. Call Claude via Agent SDK (non-streaming, no tools)
  let responseText: string | null = null;
  await instrumentQuery("voice-calibration-wizard", workspaceId, async () => {
    for await (const message of query({
      prompt: userMessage,
      options: {
        systemPrompt: VOICE_CALIBRATION_PROMPT,
        model: getOpusModel(),
        maxTurns: 1,
      },
    })) {
      if ("result" in message) {
        responseText = message.result;
      }
    }
  });

  if (!responseText) {
    return null;
  }

  // 4. Parse the JSON response
  let voiceData: VoiceCalibrationResponse;
  try {
    voiceData = JSON.parse(responseText) as VoiceCalibrationResponse;
  } catch {
    return null;
  }

  // 5. Map Claude's response to DB schema columns
  const voiceCharacteristics = [
    `Formality: ${voiceData.formalityScore}/10`,
    `Technical depth: ${voiceData.technicalDepth}/10`,
    `Humor: ${voiceData.humorScore}/10`,
    `Heading style: ${voiceData.headingStyle}`,
    voiceData.openingPattern ? `Opening: ${voiceData.openingPattern}` : null,
    voiceData.closingPattern ? `Closing: ${voiceData.closingPattern}` : null,
    voiceData.punctuationPersonality
      ? `Punctuation: ${voiceData.punctuationPersonality}`
      : null,
    voiceData.sentenceRhythm
      ? `Sentence rhythm: ${voiceData.sentenceRhythm}`
      : null,
  ].filter((s): s is string => s !== null);

  const toneAttributes: Record<string, number> = {
    formality: voiceData.formalityScore,
    technicalDepth: voiceData.technicalDepth,
    humor: voiceData.humorScore,
  };

  const exampleExcerpts = voiceData.representativePassages
    .slice(0, 5)
    .map(
      (p) => `Passage: ${p.passage}\nVoice note: ${p.voiceNote}`,
    );

  // Flatten vocabularyFingerprint into an array of characteristic terms
  const vocabularyFingerprint: string[] = [
    ...voiceData.vocabularyFingerprint.signatureWords,
    ...voiceData.vocabularyFingerprint.intensifiersAndQualifiers,
  ].filter(Boolean);

  // Flatten authenticityMarkers into anti-AI pattern strings
  const antiAiPatterns: string[] = voiceData.authenticityMarkers
    .slice(0, 10)
    .map((m) => `${m.marker}: ${m.evidence}`);

  // Build customInstructions from transitional style and avoided words
  const avoidedWordsLine =
    voiceData.vocabularyFingerprint.avoidedWords.length > 0
      ? `Avoid these words/phrases: ${voiceData.vocabularyFingerprint.avoidedWords.join(", ")}. `
      : "";
  const transitionalLine = voiceData.vocabularyFingerprint.transitionalStyle
    ? `Transitional style: ${voiceData.vocabularyFingerprint.transitionalStyle}. `
    : "";
  const customInstructions =
    `${avoidedWordsLine}${transitionalLine}`.trim() || null;

  // 6. Upsert to writingStyleProfiles
  const [profile] = await db
    .insert(writingStyleProfiles)
    .values({
      workspaceId,
      voiceCharacteristics,
      toneAttributes,
      vocabularyLevel: voiceData.vocabularyNotes || "standard",
      sentenceStructure: voiceData.sentenceStructureNotes || "varied",
      exampleExcerpts,
      generationStatus: "completed",
      generatedAt: new Date(),
      calibratedFromSamples: true,
      vocabularyFingerprint,
      antiAiPatterns,
      customInstructions,
    })
    .onConflictDoUpdate({
      target: writingStyleProfiles.workspaceId,
      set: {
        voiceCharacteristics,
        toneAttributes,
        vocabularyLevel: voiceData.vocabularyNotes || "standard",
        sentenceStructure: voiceData.sentenceStructureNotes || "varied",
        exampleExcerpts,
        generationStatus: "completed",
        generatedAt: new Date(),
        calibratedFromSamples: true,
        vocabularyFingerprint,
        antiAiPatterns,
        customInstructions,
        updatedAt: new Date(),
      },
    })
    .returning();

  return profile ?? null;
}
