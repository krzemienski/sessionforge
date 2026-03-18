import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { db } from "@/lib/db";
import { posts, workspaces } from "@sessionforge/db";
import { eq } from "drizzle-orm";
import { createPost, updatePost, getPost } from "../post-manager";

// Test workspace ID
const TEST_WORKSPACE_ID = "test-workspace-citation-extraction";

describe("post-manager citation extraction", () => {
  beforeEach(async () => {
    // Clean up any existing test data
    await db.delete(posts).where(eq(posts.workspaceId, TEST_WORKSPACE_ID));

    // Create test workspace if it doesn't exist
    await db
      .insert(workspaces)
      .values({
        id: TEST_WORKSPACE_ID,
        name: "Test Workspace",
        slug: "test-workspace",
      })
      .onConflictDoNothing();
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(posts).where(eq(posts.workspaceId, TEST_WORKSPACE_ID));
  });

  describe("createPost", () => {
    it("should extract and store citations from markdown", async () => {
      const markdown = `# Technical Deep Dive

We refactored the authentication module[@550e8400-e29b-41d4-a716-446655440000:10] to use JWT tokens instead of sessions.

The new approach[@550e8400-e29b-41d4-a716-446655440000:15] significantly improved performance.`;

      const post = await createPost({
        workspaceId: TEST_WORKSPACE_ID,
        title: "Test Post with Citations",
        markdown,
        contentType: "blog_post",
      });

      expect(post.citations).toBeDefined();
      expect(post.citations).toHaveLength(2);

      // Verify first citation
      expect(post.citations![0].sessionId).toBe("550e8400-e29b-41d4-a716-446655440000");
      expect(post.citations![0].messageIndex).toBe(10);
      expect(post.citations![0].type).toBe("evidence");
      expect(post.citations![0].text).toContain("authentication module");

      // Verify second citation
      expect(post.citations![1].sessionId).toBe("550e8400-e29b-41d4-a716-446655440000");
      expect(post.citations![1].messageIndex).toBe(15);
      expect(post.citations![1].type).toBe("evidence");
      expect(post.citations![1].text).toContain("new approach");
    });

    it("should handle markdown without citations", async () => {
      const markdown = `# Simple Post

This is a post without any citations.`;

      const post = await createPost({
        workspaceId: TEST_WORKSPACE_ID,
        title: "Post Without Citations",
        markdown,
        contentType: "blog_post",
      });

      expect(post.citations).toBeDefined();
      expect(post.citations).toHaveLength(0);
    });

    it("should ignore citations in code blocks", async () => {
      const markdown = `# Code Example

Here's how to use citations:

\`\`\`markdown
This is a citation[@session:5] in a code block
\`\`\`

But this one[@550e8400-e29b-41d4-a716-446655440000:20] is real.`;

      const post = await createPost({
        workspaceId: TEST_WORKSPACE_ID,
        title: "Post With Code Block",
        markdown,
        contentType: "blog_post",
      });

      expect(post.citations).toBeDefined();
      expect(post.citations).toHaveLength(1);
      expect(post.citations![0].messageIndex).toBe(20);
    });

    it("should handle multiple citations from different sessions", async () => {
      const markdown = `# Multi-Session Post

First insight[@session1:5] from session 1.
Second insight[@session2:10] from session 2.
Third insight[@session1:15] back to session 1.`;

      const post = await createPost({
        workspaceId: TEST_WORKSPACE_ID,
        title: "Multi-Session Citations",
        markdown,
        contentType: "blog_post",
      });

      expect(post.citations).toBeDefined();
      expect(post.citations).toHaveLength(3);
      expect(post.citations![0].sessionId).toBe("session1");
      expect(post.citations![1].sessionId).toBe("session2");
      expect(post.citations![2].sessionId).toBe("session1");
    });
  });

  describe("updatePost", () => {
    it("should re-extract citations when markdown is updated", async () => {
      // Create initial post with one citation
      const initialMarkdown = `# Initial Post

Initial content[@session1:5] with citation.`;

      const post = await createPost({
        workspaceId: TEST_WORKSPACE_ID,
        title: "Updatable Post",
        markdown: initialMarkdown,
        contentType: "blog_post",
      });

      expect(post.citations).toHaveLength(1);
      expect(post.citations![0].messageIndex).toBe(5);

      // Update with new markdown containing different citations
      const updatedMarkdown = `# Updated Post

New content[@session2:10] with different citation.
And another[@session2:15] citation.`;

      const updatedPost = await updatePost(TEST_WORKSPACE_ID, post.id, {
        markdown: updatedMarkdown,
      });

      expect(updatedPost.citations).toBeDefined();
      expect(updatedPost.citations).toHaveLength(2);
      expect(updatedPost.citations![0].sessionId).toBe("session2");
      expect(updatedPost.citations![0].messageIndex).toBe(10);
      expect(updatedPost.citations![1].messageIndex).toBe(15);
    });

    it("should preserve citations when updating other fields", async () => {
      const markdown = `# Post

Content[@session1:5] with citation.`;

      const post = await createPost({
        workspaceId: TEST_WORKSPACE_ID,
        title: "Original Title",
        markdown,
        contentType: "blog_post",
      });

      const originalCitations = post.citations;

      // Update only the title
      const updatedPost = await updatePost(TEST_WORKSPACE_ID, post.id, {
        title: "Updated Title",
      });

      // Citations should remain unchanged
      expect(updatedPost.citations).toEqual(originalCitations);
    });

    it("should clear citations when markdown is updated to content without citations", async () => {
      const initialMarkdown = `# Initial Post

Content[@session1:5] with citation.`;

      const post = await createPost({
        workspaceId: TEST_WORKSPACE_ID,
        title: "Post With Citation",
        markdown: initialMarkdown,
        contentType: "blog_post",
      });

      expect(post.citations).toHaveLength(1);

      // Update to markdown without citations
      const updatedPost = await updatePost(TEST_WORKSPACE_ID, post.id, {
        markdown: "# Simple post without citations",
      });

      expect(updatedPost.citations).toBeDefined();
      expect(updatedPost.citations).toHaveLength(0);
    });
  });

  describe("getPost", () => {
    it("should retrieve post with citations", async () => {
      const markdown = `# Post

Content[@session1:5] with citation.`;

      const createdPost = await createPost({
        workspaceId: TEST_WORKSPACE_ID,
        title: "Test Post",
        markdown,
        contentType: "blog_post",
      });

      const retrievedPost = await getPost(TEST_WORKSPACE_ID, createdPost.id);

      expect(retrievedPost.citations).toBeDefined();
      expect(retrievedPost.citations).toHaveLength(1);
      expect(retrievedPost.citations![0].sessionId).toBe("session1");
      expect(retrievedPost.citations![0].messageIndex).toBe(5);
    });
  });
});
