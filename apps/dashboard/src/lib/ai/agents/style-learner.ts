import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { posts, writingStyleProfiles } from "@sessionforge/db";
import { and, eq, isNotNull } from "drizzle-orm";
import { STYLE_LEARNER_PROMPT } from "../prompts/style-learner";
import { getOpusModel } from "../orchestration/model-selector";

const client = new Anthropic();

const MIN_POSTS_REQUIRED = 5;

export type WritingStyleProfile = typeof writingStyleProfiles.$inferSelect;

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
  workspaceId: string
): Promise<WritingStyleProfile | null> {
  // 1. Fetch all published posts with an AI draft saved
  const qualifyingPosts = await db
    .select()
    .from(posts)
    .where(
      and(
        eq(posts.workspaceId, workspaceId),
        eq(posts.status, "published"),
        isNotNull(posts.aiDraftMarkdown)
      )
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

  // 4. Call Claude with STYLE_LEARNER_PROMPT (non-streaming, no tools)
  const response = await client.messages.create({
    model: getOpusModel(),
    max_tokens: 4096,
    system: STYLE_LEARNER_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  // 5. Extract and parse the JSON response
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return null;
  }

  let styleData: StyleLearnerResponse;
  try {
    styleData = JSON.parse(textBlock.text) as StyleLearnerResponse;
  } catch {
    return null;
  }

  // 6. Map Claude's response to the DB schema
  const headingStyleData = {
    preferredLevels: ["h2", "h3"],
    capitalization:
      styleData.headingStyle === "sentence_case"
        ? ("sentence" as const)
        : ("title" as const),
    includeEmoji: false,
  };

  const codeStyleData = {
    commentDensity: (
      styleData.codeExplanationStyle === "annotated" ? "heavy" : "moderate"
    ) as "minimal" | "moderate" | "heavy",
    preferInlineComments: styleData.codeExplanationStyle === "inline",
    explanationStyle: (
      styleData.codeExplanationStyle === "separate" ? "before" : "inline"
    ) as "before" | "after" | "inline",
  };

  const vocabularyPatterns = [
    styleData.vocabularyNotes,
    styleData.sentenceStructureNotes,
    styleData.openingPattern,
    styleData.closingPattern,
  ].filter((s): s is string => typeof s === "string" && s.trim().length > 0);

  const sampleEdits = styleData.representativeEdits.map((edit) => ({
    original: edit.original,
    edited: edit.edited,
    postId: "",
  }));

  // 7. Upsert to writingStyleProfiles
  const [profile] = await db
    .insert(writingStyleProfiles)
    .values({
      workspaceId,
      formality: styleData.formalityScore,
      technicalDepth: styleData.technicalDepth,
      humor: styleData.humorScore,
      headingStyle: headingStyleData,
      codeStyle: codeStyleData,
      vocabularyPatterns,
      sampleEdits,
      publishedPostsAnalyzed: qualifyingPosts.length,
      generationStatus: "completed",
      lastGeneratedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: writingStyleProfiles.workspaceId,
      set: {
        formality: styleData.formalityScore,
        technicalDepth: styleData.technicalDepth,
        humor: styleData.humorScore,
        headingStyle: headingStyleData,
        codeStyle: codeStyleData,
        vocabularyPatterns,
        sampleEdits,
        publishedPostsAnalyzed: qualifyingPosts.length,
        generationStatus: "completed",
        lastGeneratedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning();

  return profile ?? null;
}
