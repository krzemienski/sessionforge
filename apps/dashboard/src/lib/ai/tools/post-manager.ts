import { db } from "@/lib/db";
import { posts } from "@sessionforge/db";
import { eq, and, desc } from "drizzle-orm";
import type { contentTypeEnum, postStatusEnum, toneProfileEnum } from "@sessionforge/db";

type ContentType = (typeof contentTypeEnum.enumValues)[number];
type PostStatus = (typeof postStatusEnum.enumValues)[number];
type ToneProfile = (typeof toneProfileEnum.enumValues)[number];

export interface CreatePostInput {
  workspaceId: string;
  title: string;
  markdown: string;
  contentType: ContentType;
  insightId?: string;
  status?: PostStatus;
  toneUsed?: ToneProfile;
  sourceMetadata?: {
    sessionIds: string[];
    insightIds: string[];
    lookbackWindow?: string;
    generatedBy: "blog_writer" | "social_writer" | "changelog_writer" | "editor_chat" | "manual" | "newsletter_writer";
  };
}

export interface UpdatePostInput {
  title?: string;
  markdown?: string;
  content?: string;
  status?: PostStatus;
  toneUsed?: ToneProfile;
}

function markdownToHtml(markdown: string): string {
  // Basic markdown-to-plain-content conversion for the content field
  // Real rendering happens on the frontend
  return markdown;
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export async function createPost(input: CreatePostInput) {
  const content = markdownToHtml(input.markdown);
  const wordCount = countWords(input.markdown);

  const [created] = await db
    .insert(posts)
    .values({
      workspaceId: input.workspaceId,
      title: input.title,
      content,
      markdown: input.markdown,
      contentType: input.contentType,
      insightId: input.insightId,
      status: input.status ?? "draft",
      toneUsed: input.toneUsed,
      wordCount,
      sourceMetadata: input.sourceMetadata,
    })
    .returning();

  return created;
}

export async function updatePost(
  workspaceId: string,
  postId: string,
  input: UpdatePostInput
) {
  const updates: Record<string, unknown> = {};

  if (input.title !== undefined) updates.title = input.title;
  if (input.status !== undefined) updates.status = input.status;
  if (input.toneUsed !== undefined) updates.toneUsed = input.toneUsed;

  if (input.markdown !== undefined) {
    updates.markdown = input.markdown;
    updates.content = markdownToHtml(input.markdown);
    updates.wordCount = countWords(input.markdown);
  } else if (input.content !== undefined) {
    updates.content = input.content;
  }

  const [updated] = await db
    .update(posts)
    .set(updates)
    .where(and(eq(posts.id, postId), eq(posts.workspaceId, workspaceId)))
    .returning();

  if (!updated) {
    throw new Error(`Post ${postId} not found`);
  }

  return updated;
}

export async function getPost(workspaceId: string, postId: string) {
  const post = await db.query.posts.findFirst({
    where: and(eq(posts.id, postId), eq(posts.workspaceId, workspaceId)),
  });

  if (!post) {
    throw new Error(`Post ${postId} not found`);
  }

  return post;
}

export async function getMarkdown(workspaceId: string, postId: string): Promise<string> {
  const post = await getPost(workspaceId, postId);
  return post.markdown;
}

// MCP tool definitions
export const postManagerTools = [
  {
    name: "create_post",
    description: "Create a new post/content item in the database.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string" },
        markdown: { type: "string", description: "Full markdown content" },
        contentType: { type: "string" },
        insightId: { type: "string" },
        status: { type: "string" },
        toneUsed: { type: "string" },
        sourceMetadata: { type: "object" },
      },
      required: ["title", "markdown", "contentType"],
    },
  },
  {
    name: "update_post",
    description: "Update an existing post by ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        postId: { type: "string" },
        title: { type: "string" },
        markdown: { type: "string" },
        status: { type: "string" },
        toneUsed: { type: "string" },
      },
      required: ["postId"],
    },
  },
  {
    name: "get_post",
    description: "Get a post by ID including all metadata.",
    input_schema: {
      type: "object" as const,
      properties: {
        postId: { type: "string" },
      },
      required: ["postId"],
    },
  },
  {
    name: "get_markdown",
    description: "Get just the markdown content of a post.",
    input_schema: {
      type: "object" as const,
      properties: {
        postId: { type: "string" },
      },
      required: ["postId"],
    },
  },
];

export async function handlePostManagerTool(
  workspaceId: string,
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<unknown> {
  switch (toolName) {
    case "create_post":
      return createPost({
        workspaceId,
        ...(toolInput as Omit<CreatePostInput, "workspaceId">),
      });
    case "update_post":
      return updatePost(
        workspaceId,
        toolInput.postId as string,
        toolInput as UpdatePostInput
      );
    case "get_post":
      return getPost(workspaceId, toolInput.postId as string);
    case "get_markdown":
      return getMarkdown(workspaceId, toolInput.postId as string);
    default:
      throw new Error(`Unknown post manager tool: ${toolName}`);
  }
}
