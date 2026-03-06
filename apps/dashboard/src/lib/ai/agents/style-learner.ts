/**
 * Style learner agent that analyzes published posts and their AI drafts
 * to build a writing style profile. Uses the Agent SDK for text generation
 * (no tools needed — pure analysis).
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import { instrumentQuery } from "@/lib/observability/instrument-query";

delete process.env.CLAUDECODE;

import { db } from "@/lib/db";
import { posts, writingStyleProfiles } from "@sessionforge/db";
import { and, eq, isNotNull } from "drizzle-orm/sql";
import { STYLE_LEARNER_PROMPT } from "../prompts/style-learner";
import { getOpusModel } from "../orchestration/model-selector";

export type WritingStyleProfile = typeof writingStyleProfiles.$inferSelect;

const MIN_POSTS_REQUIRED = 5;

interface StyleLearnerResponse {
  formalityScore: number;
  technicalDepth: number;
  humorScore: number;
  headingStyle: "sentence_case" | "title_case";
  codeExplanationStyle: "inline" | "separate" | "annotated";
  openingPattern: string;
  closingPattern: string;
  vocabularyNotes: string;
  sentenceStructureNotes: string;
  representativeEdits: Array<{
    original: string;
    edited: string;
    pattern: string;
  }>;
}

export async function analyzeWritingStyle(
  workspaceId: string,
): Promise<WritingStyleProfile | null> {
  // 1. Fetch all published posts with an AI draft saved
  const qualifyingPosts = await db
    .select()
    .from(posts)
    .where(
      and(
        eq(posts.workspaceId, workspaceId),
        eq(posts.status, "published"),
        isNotNull(posts.aiDraftMarkdown),
      ),
    );

  // 2. Require at least 5 posts to generate a meaningful profile
  if (qualifyingPosts.length < MIN_POSTS_REQUIRED) {
    return null;
  }

  // 3. Build the content payload for Claude
  const postsContent = qualifyingPosts
    .map((post, i) => {
      return [
        `## Post ${i + 1}: "${post.title}"`,
        ``,
        `### Original AI Draft`,
        post.aiDraftMarkdown,
        ``,
        `### Final Published Version`,
        post.markdown,
        ``,
        `---`,
      ].join("\n");
    })
    .join("\n\n");

  const userMessage = `Analyze the following ${qualifyingPosts.length} published posts and their original AI-generated drafts to build a writing style profile.\n\n${postsContent}`;

  // 4. Call Claude via Agent SDK (non-streaming, no tools)
  let responseText: string | null = null;
  await instrumentQuery("style-learner", workspaceId, async () => {
    for await (const message of query({
      prompt: userMessage,
      options: {
        systemPrompt: STYLE_LEARNER_PROMPT,
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

  // 5. Parse the JSON response
  let styleData: StyleLearnerResponse;
  try {
    styleData = JSON.parse(responseText) as StyleLearnerResponse;
  } catch {
    return null;
  }

  // 6. Map Claude's response to the DB schema columns
  const voiceCharacteristics = [
    `Formality: ${styleData.formalityScore}/10`,
    `Technical depth: ${styleData.technicalDepth}/10`,
    `Humor: ${styleData.humorScore}/10`,
    `Heading style: ${styleData.headingStyle}`,
    `Code explanation: ${styleData.codeExplanationStyle}`,
    styleData.openingPattern ? `Opening: ${styleData.openingPattern}` : null,
    styleData.closingPattern ? `Closing: ${styleData.closingPattern}` : null,
  ].filter((s): s is string => s !== null);

  const toneAttributes: Record<string, number> = {
    formality: styleData.formalityScore,
    technicalDepth: styleData.technicalDepth,
    humor: styleData.humorScore,
  };

  const exampleExcerpts = styleData.representativeEdits
    .slice(0, 5)
    .map((edit) => `Original: ${edit.original}\nEdited: ${edit.edited}\nPattern: ${edit.pattern}`);

  // 7. Upsert to writingStyleProfiles
  const [profile] = await db
    .insert(writingStyleProfiles)
    .values({
      workspaceId,
      voiceCharacteristics,
      toneAttributes,
      vocabularyLevel: styleData.vocabularyNotes || "standard",
      sentenceStructure: styleData.sentenceStructureNotes || "varied",
      exampleExcerpts,
      generationStatus: "completed",
      generatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: writingStyleProfiles.workspaceId,
      set: {
        voiceCharacteristics,
        toneAttributes,
        vocabularyLevel: styleData.vocabularyNotes || "standard",
        sentenceStructure: styleData.sentenceStructureNotes || "varied",
        exampleExcerpts,
        generationStatus: "completed",
        generatedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning();

  return profile ?? null;
}
