import { describe, it, expect } from "bun:test";
import { CitationExtractor } from "@/lib/citations/extractor";

/**
 * Extract citations from markdown content and convert to database format.
 * This is a copy of the function from post-manager.ts for testing purposes.
 */
function extractCitations(markdown: string): {
  sessionId: string;
  messageIndex: number;
  text: string;
  type: "tool_call" | "file_edit" | "conversation" | "evidence";
}[] {
  const extractor = new CitationExtractor();
  const citationsWithContext = extractor.extractWithContext(markdown, 100);

  return citationsWithContext.map((citation) => ({
    sessionId: citation.sessionId,
    messageIndex: citation.messageIndex,
    text: `${citation.textBefore.trim()} ${citation.textAfter.trim()}`.trim(),
    type: "evidence" as const,
  }));
}

describe("post-manager citation extraction (unit tests)", () => {
  describe("extractCitations", () => {
    it("should extract and format citations from markdown", () => {
      const markdown = `# Technical Deep Dive

We refactored the authentication module[@550e8400-e29b-41d4-a716-446655440000:10] to use JWT tokens instead of sessions.

The new approach[@550e8400-e29b-41d4-a716-446655440000:15] significantly improved performance.`;

      const citations = extractCitations(markdown);

      expect(citations).toHaveLength(2);

      // Verify first citation
      expect(citations[0].sessionId).toBe("550e8400-e29b-41d4-a716-446655440000");
      expect(citations[0].messageIndex).toBe(10);
      expect(citations[0].type).toBe("evidence");
      expect(citations[0].text).toContain("authentication module");
      expect(citations[0].text).toContain("JWT tokens");

      // Verify second citation
      expect(citations[1].sessionId).toBe("550e8400-e29b-41d4-a716-446655440000");
      expect(citations[1].messageIndex).toBe(15);
      expect(citations[1].type).toBe("evidence");
      expect(citations[1].text).toContain("new approach");
      expect(citations[1].text).toContain("performance");
    });

    it("should return empty array for markdown without citations", () => {
      const markdown = `# Simple Post

This is a post without any citations.`;

      const citations = extractCitations(markdown);

      expect(citations).toHaveLength(0);
    });

    it("should ignore citations in code blocks", () => {
      const markdown = `# Code Example

Here's how to use citations:

\`\`\`markdown
This is a citation[@session:5] in a code block
\`\`\`

But this one[@550e8400-e29b-41d4-a716-446655440000:20] is real.`;

      const citations = extractCitations(markdown);

      expect(citations).toHaveLength(1);
      expect(citations[0].messageIndex).toBe(20);
    });

    it("should handle multiple citations from different sessions", () => {
      const markdown = `# Multi-Session Post

First insight[@session1:5] from session 1.
Second insight[@session2:10] from session 2.
Third insight[@session1:15] back to session 1.`;

      const citations = extractCitations(markdown);

      expect(citations).toHaveLength(3);
      expect(citations[0].sessionId).toBe("session1");
      expect(citations[0].messageIndex).toBe(5);
      expect(citations[1].sessionId).toBe("session2");
      expect(citations[1].messageIndex).toBe(10);
      expect(citations[2].sessionId).toBe("session1");
      expect(citations[2].messageIndex).toBe(15);
    });

    it("should extract context text around citations", () => {
      const markdown = `We implemented user authentication[@session1:10] using bcrypt for password hashing.`;

      const citations = extractCitations(markdown);

      expect(citations).toHaveLength(1);
      expect(citations[0].text).toContain("user authentication");
      expect(citations[0].text).toContain("bcrypt");
    });

    it("should handle citations at the beginning of text", () => {
      const markdown = `[@session1:5] This citation is at the start.`;

      const citations = extractCitations(markdown);

      expect(citations).toHaveLength(1);
      expect(citations[0].sessionId).toBe("session1");
      expect(citations[0].messageIndex).toBe(5);
      expect(citations[0].text).toContain("This citation is at the start");
    });

    it("should handle citations at the end of text", () => {
      const markdown = `This citation is at the end[@session1:5]`;

      const citations = extractCitations(markdown);

      expect(citations).toHaveLength(1);
      expect(citations[0].sessionId).toBe("session1");
      expect(citations[0].messageIndex).toBe(5);
      expect(citations[0].text).toContain("citation is at the end");
    });

    it("should handle inline code with citations outside", () => {
      const markdown = `We used \`bcrypt\` for password hashing[@session1:10] in our implementation.`;

      const citations = extractCitations(markdown);

      expect(citations).toHaveLength(1);
      expect(citations[0].messageIndex).toBe(10);
      expect(citations[0].text).toContain("password hashing");
    });

    it("should extract all citation metadata correctly", () => {
      const markdown = `Testing[@test-session-123:42] with specific IDs.`;

      const citations = extractCitations(markdown);

      expect(citations).toHaveLength(1);
      expect(citations[0]).toMatchObject({
        sessionId: "test-session-123",
        messageIndex: 42,
        type: "evidence",
      });
      expect(citations[0].text).toBeTruthy();
    });
  });
});
