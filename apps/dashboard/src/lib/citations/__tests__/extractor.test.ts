/**
 * Citation Extractor Tests
 *
 * Tests for parsing citation markers from markdown content.
 * Citation markers use the format: [@sessionId:messageIndex]
 */

import { describe, test, expect } from "bun:test";
import { CitationExtractor } from "../extractor";

describe("CitationExtractor", () => {
  describe("extract", () => {
    test("extracts single citation from markdown", () => {
      const markdown = "This is a claim[@abc123:5] about refactoring.";
      const extractor = new CitationExtractor();
      const citations = extractor.extract(markdown);

      expect(citations).toHaveLength(1);
      expect(citations[0]).toMatchObject({
        sessionId: "abc123",
        messageIndex: 5,
        marker: "[@abc123:5]",
        position: 15,
      });
    });

    test("extracts multiple citations from markdown", () => {
      const markdown = `We refactored the auth module[@session1:10] and improved performance[@session2:25].`;
      const extractor = new CitationExtractor();
      const citations = extractor.extract(markdown);

      expect(citations).toHaveLength(2);
      expect(citations[0].sessionId).toBe("session1");
      expect(citations[0].messageIndex).toBe(10);
      expect(citations[1].sessionId).toBe("session2");
      expect(citations[1].messageIndex).toBe(25);
    });

    test("handles UUIDs in sessionId", () => {
      const markdown = "Fixed bug[@550e8400-e29b-41d4-a716-446655440000:42].";
      const extractor = new CitationExtractor();
      const citations = extractor.extract(markdown);

      expect(citations).toHaveLength(1);
      expect(citations[0].sessionId).toBe(
        "550e8400-e29b-41d4-a716-446655440000"
      );
      expect(citations[0].messageIndex).toBe(42);
    });

    test("returns empty array for markdown without citations", () => {
      const markdown = "This is plain markdown without any citations.";
      const extractor = new CitationExtractor();
      const citations = extractor.extract(markdown);

      expect(citations).toEqual([]);
    });

    test("ignores malformed citation markers", () => {
      const markdown = `
        Valid citation[@session1:10].
        Invalid: [@session2] (no message index)
        Invalid: [session3:5] (no @ symbol)
        Invalid: [@session4:abc] (non-numeric index)
      `;
      const extractor = new CitationExtractor();
      const citations = extractor.extract(markdown);

      expect(citations).toHaveLength(1);
      expect(citations[0].sessionId).toBe("session1");
    });

    test("handles citations in different markdown contexts", () => {
      const markdown = `
# Heading with citation[@session1:1]

Regular paragraph[@session2:2].

- List item[@session3:3]
- Another item

> Quote with citation[@session4:4]

\`\`\`js
// Code should not be parsed[@session5:5]
\`\`\`

Inline \`code[@session6:6]\` should not be parsed.
      `;
      const extractor = new CitationExtractor();
      const citations = extractor.extract(markdown);

      // Should find citations in heading, paragraph, list, and quote
      // but NOT in code blocks or inline code
      expect(citations).toHaveLength(4);
      expect(citations.map((c) => c.sessionId)).toEqual([
        "session1",
        "session2",
        "session3",
        "session4",
      ]);
    });

    test("preserves order of citations as they appear", () => {
      const markdown = "Third[@c:3] first[@a:1] second[@b:2].";
      const extractor = new CitationExtractor();
      const citations = extractor.extract(markdown);

      expect(citations[0].sessionId).toBe("c");
      expect(citations[1].sessionId).toBe("a");
      expect(citations[2].sessionId).toBe("b");
    });
  });

  describe("extractWithContext", () => {
    test("extracts citation with surrounding text context", () => {
      const markdown =
        "We implemented a new authentication flow[@session1:10] using JWT tokens.";
      const extractor = new CitationExtractor();
      const citations = extractor.extractWithContext(markdown, 20);

      expect(citations).toHaveLength(1);
      expect(citations[0].textBefore).toBe(" authentication flow");
      expect(citations[0].textAfter).toBe(" using JWT tokens.");
    });

    test("limits context to specified character count", () => {
      const markdown =
        "This is a very long sentence with lots of words before the citation[@session1:5] and also many words after it continues.";
      const extractor = new CitationExtractor();
      const citations = extractor.extractWithContext(markdown, 10);

      expect(citations[0].textBefore.length).toBeLessThanOrEqual(10);
      expect(citations[0].textAfter.length).toBeLessThanOrEqual(10);
    });

    test("handles citations at start of text", () => {
      const markdown = "[@session1:1]This starts with a citation.";
      const extractor = new CitationExtractor();
      const citations = extractor.extractWithContext(markdown, 20);

      expect(citations[0].textBefore).toBe("");
      expect(citations[0].textAfter).toBe("This starts with a c");
    });

    test("handles citations at end of text", () => {
      const markdown = "This ends with a citation[@session1:1]";
      const extractor = new CitationExtractor();
      const citations = extractor.extractWithContext(markdown, 20);

      expect(citations[0].textBefore).toBe("ends with a citation");
      expect(citations[0].textAfter).toBe("");
    });
  });

  describe("removeCitations", () => {
    test("removes citation markers from markdown", () => {
      const markdown = "This is a claim[@session1:5] about refactoring.";
      const extractor = new CitationExtractor();
      const cleaned = extractor.removeCitations(markdown);

      expect(cleaned).toBe("This is a claim about refactoring.");
    });

    test("removes multiple citations", () => {
      const markdown = `We refactored[@s1:1] the module[@s2:2] completely[@s3:3].`;
      const extractor = new CitationExtractor();
      const cleaned = extractor.removeCitations(markdown);

      expect(cleaned).toBe("We refactored the module completely.");
    });

    test("preserves markdown formatting", () => {
      const markdown = `# Heading[@s1:1]

**Bold text**[@s2:2] and *italic*[@s3:3].

- List[@s4:4]
- Items[@s5:5]
      `;
      const extractor = new CitationExtractor();
      const cleaned = extractor.removeCitations(markdown);

      expect(cleaned).toContain("# Heading");
      expect(cleaned).toContain("**Bold text**");
      expect(cleaned).toContain("*italic*");
      expect(cleaned).toContain("- List");
      expect(cleaned).not.toContain("[@");
    });
  });

  describe("getCitationCount", () => {
    test("returns count of citations in markdown", () => {
      const markdown = "One[@s1:1] two[@s2:2] three[@s3:3].";
      const extractor = new CitationExtractor();
      const count = extractor.getCitationCount(markdown);

      expect(count).toBe(3);
    });

    test("returns 0 for markdown without citations", () => {
      const markdown = "No citations here.";
      const extractor = new CitationExtractor();
      const count = extractor.getCitationCount(markdown);

      expect(count).toBe(0);
    });
  });

  describe("hasCitations", () => {
    test("returns true if markdown has citations", () => {
      const markdown = "Has citation[@s1:1].";
      const extractor = new CitationExtractor();

      expect(extractor.hasCitations(markdown)).toBe(true);
    });

    test("returns false if markdown has no citations", () => {
      const markdown = "No citations.";
      const extractor = new CitationExtractor();

      expect(extractor.hasCitations(markdown)).toBe(false);
    });
  });
});
