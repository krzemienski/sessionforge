import { diffLines, type Change } from "diff";
import { db } from "@/lib/db";
import { postRevisions } from "@sessionforge/db";
import { eq, desc, inArray } from "drizzle-orm";
import type { editTypeEnum, versionTypeEnum } from "@sessionforge/db";

type EditType = (typeof editTypeEnum.enumValues)[number];
type VersionType = (typeof versionTypeEnum.enumValues)[number];

export type { Change as DiffChange };

export interface CreateRevisionInput {
  postId: string;
  title: string;
  markdown: string;
  versionType: VersionType;
  editType: EditType;
  createdBy?: string;
  versionLabel?: string;
  versionNotes?: string;
}

export type RevisionRow = typeof postRevisions.$inferSelect;

export type RevisionSummary = Omit<
  RevisionRow,
  "contentSnapshot" | "contentDiff"
>;

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function applyDiff(baseContent: string, diffOps: Change[]): string {
  return diffOps
    .filter((op) => !op.removed)
    .map((op) => op.value)
    .join("");
}

export function computeLineDiff(
  oldContent: string,
  newContent: string
): Change[] {
  return diffLines(oldContent, newContent);
}

async function pruneOldRevisions(postId: string): Promise<void> {
  const allRevisions = await db
    .select({ id: postRevisions.id })
    .from(postRevisions)
    .where(eq(postRevisions.postId, postId))
    .orderBy(desc(postRevisions.versionNumber));

  if (allRevisions.length > 50) {
    const toDelete = allRevisions.slice(50);
    const idsToDelete = toDelete.map((r) => r.id);

    if (idsToDelete.length > 0) {
      await db
        .delete(postRevisions)
        .where(inArray(postRevisions.id, idsToDelete));
    }
  }
}

export async function createRevision(
  input: CreateRevisionInput
): Promise<RevisionRow> {
  const latest = await db.query.postRevisions.findFirst({
    where: eq(postRevisions.postId, input.postId),
    orderBy: [desc(postRevisions.versionNumber)],
  });

  const versionNumber = latest ? latest.versionNumber + 1 : 1;
  const wordCount = countWords(input.markdown);

  if (!latest) {
    const [created] = await db
      .insert(postRevisions)
      .values({
        postId: input.postId,
        versionNumber,
        versionType: input.versionType,
        editType: input.editType,
        contentSnapshot: input.markdown,
        contentDiff: null,
        parentRevisionId: null,
        title: input.title,
        wordCount,
        wordCountDelta: wordCount,
        createdBy: input.createdBy,
        versionLabel: input.versionLabel,
        versionNotes: input.versionNotes,
      })
      .returning();

    return created;
  }

  const prevContent = await getRevisionContent(latest.id);
  const diffOps = computeLineDiff(prevContent, input.markdown);
  const prevWordCount = latest.wordCount ?? 0;

  const [created] = await db
    .insert(postRevisions)
    .values({
      postId: input.postId,
      versionNumber,
      versionType: input.versionType,
      editType: input.editType,
      contentSnapshot: null,
      contentDiff: diffOps,
      parentRevisionId: latest.id,
      title: input.title,
      wordCount,
      wordCountDelta: wordCount - prevWordCount,
      createdBy: input.createdBy,
      versionLabel: input.versionLabel,
      versionNotes: input.versionNotes,
    })
    .returning();

  // Auto-prune to keep only last 50 versions
  if (versionNumber > 50) {
    await pruneOldRevisions(input.postId);
  }

  return created;
}

export async function listRevisions(
  postId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<RevisionSummary[]> {
  const { limit = 50, offset = 0 } = options;

  const rows = await db
    .select({
      id: postRevisions.id,
      postId: postRevisions.postId,
      versionNumber: postRevisions.versionNumber,
      versionType: postRevisions.versionType,
      editType: postRevisions.editType,
      parentRevisionId: postRevisions.parentRevisionId,
      title: postRevisions.title,
      wordCount: postRevisions.wordCount,
      wordCountDelta: postRevisions.wordCountDelta,
      createdAt: postRevisions.createdAt,
      createdBy: postRevisions.createdBy,
      versionLabel: postRevisions.versionLabel,
      versionNotes: postRevisions.versionNotes,
    })
    .from(postRevisions)
    .where(eq(postRevisions.postId, postId))
    .orderBy(desc(postRevisions.versionNumber))
    .limit(limit)
    .offset(offset);

  return rows;
}

export async function getRevision(revisionId: string): Promise<RevisionRow> {
  const revision = await db.query.postRevisions.findFirst({
    where: eq(postRevisions.id, revisionId),
  });

  if (!revision) {
    throw new Error(`Revision ${revisionId} not found`);
  }

  return revision;
}

export async function getRevisionContent(revisionId: string): Promise<string> {
  const revision = await getRevision(revisionId);

  if (revision.contentSnapshot !== null) {
    return revision.contentSnapshot;
  }

  // Walk the parent chain back to the snapshot, collecting revisions in order
  const chain: RevisionRow[] = [revision];
  let current = revision;

  while (current.contentSnapshot === null && current.parentRevisionId) {
    const parent = await db.query.postRevisions.findFirst({
      where: eq(postRevisions.id, current.parentRevisionId),
    });

    if (!parent) {
      throw new Error(
        `Parent revision ${current.parentRevisionId} not found`
      );
    }

    chain.unshift(parent);
    current = parent;
  }

  if (chain[0].contentSnapshot === null) {
    throw new Error(
      `No base snapshot found in revision chain for ${revisionId}`
    );
  }

  // Apply each diff in order to reconstruct the target content
  let content = chain[0].contentSnapshot;
  for (let i = 1; i < chain.length; i++) {
    const diffOps = chain[i].contentDiff;
    if (!diffOps) {
      throw new Error(
        `Revision ${chain[i].id} has neither snapshot nor diff`
      );
    }
    content = applyDiff(content, diffOps as Change[]);
  }

  return content;
}
