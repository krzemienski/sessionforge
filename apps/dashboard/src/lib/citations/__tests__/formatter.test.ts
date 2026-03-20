/**
 * Citation Formatter Tests
 *
 * Tests for formatting citations into different output formats:
 * - Footnotes: Academic-style numbered citations with references section
 * - Inline: Clickable inline citation links
 * - Cards: Expandable evidence cards with full context
 */

import { describe, test, expect } from "vitest";
import {
  CitationFormatter,
  type CitationMetadata,
} from "../formatter";

describe("CitationFormatter", () => {
  const sampleCitation: CitationMetadata = {
    sessionId: "abc123",
    messageIndex: 10,
    text: "Refactored authentication module using JWT tokens",
    type: "file_edit",
  };

  describe("formatCitation", () => {
    describe("footnote format", () => {
      test("formats citation as footnote reference number", () => {
        const formatter = new CitationFormatter();
        const formatted = formatter.formatCitation(
          sampleCitation,
          "footnote",
          1
        );

        expect(formatted.content).toBe("[1]");
        expect(formatted.referenceNumber).toBe(1);
        expect(formatted.transcriptUrl).toBe(
          "/sessions/abc123#msg-10"
        );
      });

      test("throws error if reference number is missing", () => {
        const formatter = new CitationFormatter();

        expect(() => {
          formatter.formatCitation(sampleCitation, "footnote");
        }).toThrow("Reference number required for footnote format");
      });

      test("uses custom base URL when provided", () => {
        const formatter = new CitationFormatter();
        const formatted = formatter.formatCitation(
          sampleCitation,
          "footnote",
          1,
          { baseUrl: "/workspace/sessions" }
        );

        expect(formatted.transcriptUrl).toBe(
          "/workspace/sessions/abc123#msg-10"
        );
      });

      test("handles base URL with trailing slash", () => {
        const formatter = new CitationFormatter();
        const formatted = formatter.formatCitation(
          sampleCitation,
          "footnote",
          1,
          { baseUrl: "/workspace/sessions/" }
        );

        expect(formatted.transcriptUrl).toBe(
          "/workspace/sessions/abc123#msg-10"
        );
      });
    });

    describe("inline format", () => {
      test("formats citation as inline link with type label", () => {
        const formatter = new CitationFormatter();
        const formatted = formatter.formatCitation(
          sampleCitation,
          "inline"
        );

        expect(formatted.content).toBe(
          "[[File Edit]](/sessions/abc123#msg-10)"
        );
        expect(formatted.transcriptUrl).toBe(
          "/sessions/abc123#msg-10"
        );
      });

      test("uses generic label when includeTypeLabel is false", () => {
        const formatter = new CitationFormatter();
        const formatted = formatter.formatCitation(
          sampleCitation,
          "inline",
          undefined,
          { includeTypeLabel: false }
        );

        expect(formatted.content).toBe(
          "[[View source]](/sessions/abc123#msg-10)"
        );
      });

      test("formats different citation types correctly", () => {
        const formatter = new CitationFormatter();

        const types: Array<CitationMetadata["type"]> = [
          "tool_call",
          "file_edit",
          "conversation",
          "evidence",
        ];
        const expectedLabels = [
          "Tool Call",
          "File Edit",
          "Conversation",
          "Evidence",
        ];

        types.forEach((type, index) => {
          const citation = { ...sampleCitation, type };
          const formatted = formatter.formatCitation(citation, "inline");
          expect(formatted.content).toContain(expectedLabels[index]);
        });
      });
    });

    describe("card format", () => {
      test("formats citation as expandable card with context", () => {
        const formatter = new CitationFormatter();
        const formatted = formatter.formatCitation(
          sampleCitation,
          "card"
        );

        expect(formatted.content).toContain("<details>");
        expect(formatted.content).toContain("<summary>");
        expect(formatted.content).toContain("File Edit");
        expect(formatted.content).toContain(
          "Refactored authentication module using JWT tokens"
        );
        expect(formatted.content).toContain("**Session:** abc123");
        expect(formatted.content).toContain("**Message:** #10");
        expect(formatted.content).toContain(
          "[View in session transcript](/sessions/abc123#msg-10)"
        );
      });

      test("truncates long text with ellipsis", () => {
        const formatter = new CitationFormatter();
        const longCitation: CitationMetadata = {
          sessionId: "abc123",
          messageIndex: 1,
          text: "This is a very long citation text that should be truncated when displayed in the card summary to avoid overwhelming the user with too much information at once",
          type: "conversation",
        };

        const formatted = formatter.formatCitation(longCitation, "card", undefined, {
          maxPreviewChars: 50,
        });

        const summaryMatch = formatted.content.match(
          /<summary>.*?<\/summary>/s
        );
        expect(summaryMatch).toBeTruthy();
        expect(summaryMatch![0]).toContain("...");
        expect(summaryMatch![0].length).toBeLessThan(200);
      });

      test("does not truncate short text", () => {
        const formatter = new CitationFormatter();
        const shortCitation: CitationMetadata = {
          sessionId: "abc123",
          messageIndex: 1,
          text: "Short text",
          type: "evidence",
        };

        const formatted = formatter.formatCitation(
          shortCitation,
          "card"
        );

        expect(formatted.content).toContain("Short text");
        expect(formatted.content).not.toContain("...");
      });
    });

    test("throws error for unsupported format", () => {
      const formatter = new CitationFormatter();

      expect(() => {
        formatter.formatCitation(
          sampleCitation,
          "invalid" as any,
          1
        );
      }).toThrow("Unsupported citation format: invalid");
    });
  });

  describe("formatMultiple", () => {
    const citations: CitationMetadata[] = [
      {
        sessionId: "session1",
        messageIndex: 5,
        text: "Added JWT authentication",
        type: "file_edit",
      },
      {
        sessionId: "session2",
        messageIndex: 12,
        text: "Fixed CORS configuration",
        type: "tool_call",
      },
      {
        sessionId: "session3",
        messageIndex: 8,
        text: "Discussed security best practices",
        type: "conversation",
      },
    ];

    test("formats multiple citations in footnote format", () => {
      const formatter = new CitationFormatter();
      const output = formatter.formatMultiple(citations, "footnote");

      expect(output.citations).toHaveLength(3);
      expect(output.citations[0].content).toBe("[1]");
      expect(output.citations[1].content).toBe("[2]");
      expect(output.citations[2].content).toBe("[3]");
      expect(output.references).toContain("## References");
      expect(output.references).toContain("1. [File Edit]");
      expect(output.references).toContain("2. [Tool Call]");
      expect(output.references).toContain("3. [Conversation]");
    });

    test("formats multiple citations in inline format", () => {
      const formatter = new CitationFormatter();
      const output = formatter.formatMultiple(citations, "inline");

      expect(output.citations).toHaveLength(3);
      expect(output.citations[0].content).toContain("[File Edit]");
      expect(output.citations[1].content).toContain("[Tool Call]");
      expect(output.citations[2].content).toContain("[Conversation]");
      expect(output.references).toBe(""); // No references section for inline
    });

    test("formats multiple citations in card format", () => {
      const formatter = new CitationFormatter();
      const output = formatter.formatMultiple(citations, "card");

      expect(output.citations).toHaveLength(3);
      expect(output.citations[0].content).toContain("<details>");
      expect(output.citations[1].content).toContain("<details>");
      expect(output.citations[2].content).toContain("<details>");
      expect(output.references).toBe(""); // No references section for cards
    });

    test("handles empty citations array", () => {
      const formatter = new CitationFormatter();
      const output = formatter.formatMultiple([], "footnote");

      expect(output.citations).toEqual([]);
      expect(output.content).toBe("");
      expect(output.references).toBe("");
    });

    test("includes transcript URLs for all citations", () => {
      const formatter = new CitationFormatter();
      const output = formatter.formatMultiple(citations, "footnote");

      expect(output.citations[0].transcriptUrl).toBe(
        "/sessions/session1#msg-5"
      );
      expect(output.citations[1].transcriptUrl).toBe(
        "/sessions/session2#msg-12"
      );
      expect(output.citations[2].transcriptUrl).toBe(
        "/sessions/session3#msg-8"
      );
    });
  });

  describe("replaceCitations", () => {
    test("replaces citation markers with footnotes", () => {
      const formatter = new CitationFormatter();
      const markdown =
        "We refactored[@s1:1] the auth module[@s2:2] completely.";
      const citationsMap = {
        "[@s1:1]": {
          sessionId: "s1",
          messageIndex: 1,
          text: "Refactored code",
          type: "file_edit" as const,
        },
        "[@s2:2]": {
          sessionId: "s2",
          messageIndex: 2,
          text: "Updated tests",
          type: "tool_call" as const,
        },
      };

      const output = formatter.replaceCitations(
        markdown,
        citationsMap,
        "footnote"
      );

      expect(output.content).toBe(
        "We refactored[1] the auth module[2] completely."
      );
      expect(output.references).toContain("## References");
      expect(output.references).toContain("1. [File Edit]");
      expect(output.references).toContain("2. [Tool Call]");
      expect(output.citations).toHaveLength(2);
    });

    test("replaces citation markers with inline links", () => {
      const formatter = new CitationFormatter();
      const markdown = "Fixed the bug[@bug:10] yesterday.";
      const citationsMap = {
        "[@bug:10]": {
          sessionId: "bug",
          messageIndex: 10,
          text: "Bug fix commit",
          type: "evidence" as const,
        },
      };

      const output = formatter.replaceCitations(
        markdown,
        citationsMap,
        "inline"
      );

      expect(output.content).toContain("Fixed the bug");
      expect(output.content).toContain("[[Evidence]]");
      expect(output.content).toContain("/sessions/bug#msg-10");
      expect(output.references).toBe("");
    });

    test("replaces citation markers with cards", () => {
      const formatter = new CitationFormatter();
      const markdown = "We improved performance[@perf:5] significantly.";
      const citationsMap = {
        "[@perf:5]": {
          sessionId: "perf",
          messageIndex: 5,
          text: "Performance optimization",
          type: "conversation" as const,
        },
      };

      const output = formatter.replaceCitations(
        markdown,
        citationsMap,
        "card"
      );

      expect(output.content).toContain("We improved performance");
      expect(output.content).toContain("<details>");
      expect(output.content).toContain("Conversation");
      expect(output.references).toBe("");
    });

    test("handles multiple occurrences of same citation", () => {
      const formatter = new CitationFormatter();
      const markdown = "First[@s1:1] and second[@s1:1] reference.";
      const citationsMap = {
        "[@s1:1]": {
          sessionId: "s1",
          messageIndex: 1,
          text: "Shared citation",
          type: "evidence" as const,
        },
      };

      const output = formatter.replaceCitations(
        markdown,
        citationsMap,
        "footnote"
      );

      expect(output.content).toBe("First[1] and second[1] reference.");
    });

    test("preserves markdown formatting", () => {
      const formatter = new CitationFormatter();
      const markdown = "**Bold[@s1:1]** and *italic[@s2:2]* text.";
      const citationsMap = {
        "[@s1:1]": {
          sessionId: "s1",
          messageIndex: 1,
          text: "Citation 1",
          type: "file_edit" as const,
        },
        "[@s2:2]": {
          sessionId: "s2",
          messageIndex: 2,
          text: "Citation 2",
          type: "tool_call" as const,
        },
      };

      const output = formatter.replaceCitations(
        markdown,
        citationsMap,
        "footnote"
      );

      expect(output.content).toContain("**Bold[1]**");
      expect(output.content).toContain("*italic[2]*");
    });

    test("handles empty citations map", () => {
      const formatter = new CitationFormatter();
      const markdown = "No citations here.";
      const output = formatter.replaceCitations(markdown, {}, "footnote");

      expect(output.content).toBe("No citations here.");
      expect(output.references).toBe("");
      expect(output.citations).toEqual([]);
    });
  });

  describe("buildReferencesSection", () => {
    test("builds references section with proper formatting", () => {
      const formatter = new CitationFormatter();
      const citations: CitationMetadata[] = [
        {
          sessionId: "s1",
          messageIndex: 1,
          text: "First citation",
          type: "file_edit",
        },
        {
          sessionId: "s2",
          messageIndex: 5,
          text: "Second citation",
          type: "tool_call",
        },
      ];

      const output = formatter.formatMultiple(citations, "footnote");

      expect(output.references).toContain("## References");
      expect(output.references).toContain(
        "1. [File Edit] First citation - [View in session](/sessions/s1#msg-1)"
      );
      expect(output.references).toContain(
        "2. [Tool Call] Second citation - [View in session](/sessions/s2#msg-5)"
      );
    });

    test("uses custom base URL in references", () => {
      const formatter = new CitationFormatter();
      const citations: CitationMetadata[] = [
        {
          sessionId: "s1",
          messageIndex: 1,
          text: "Citation",
          type: "evidence",
        },
      ];

      const output = formatter.formatMultiple(citations, "footnote", {
        baseUrl: "/workspace/sessions",
      });

      expect(output.references).toContain(
        "/workspace/sessions/s1#msg-1"
      );
    });

    test("returns empty string for empty citations", () => {
      const formatter = new CitationFormatter();
      const output = formatter.formatMultiple([], "footnote");

      expect(output.references).toBe("");
    });
  });

  describe("transcript URL generation", () => {
    test("generates correct URL format", () => {
      const formatter = new CitationFormatter();
      const citation: CitationMetadata = {
        sessionId: "550e8400-e29b-41d4-a716-446655440000",
        messageIndex: 42,
        text: "Test",
        type: "evidence",
      };

      const formatted = formatter.formatCitation(citation, "footnote", 1);

      expect(formatted.transcriptUrl).toBe(
        "/sessions/550e8400-e29b-41d4-a716-446655440000#msg-42"
      );
    });

    test("handles short session IDs", () => {
      const formatter = new CitationFormatter();
      const citation: CitationMetadata = {
        sessionId: "abc",
        messageIndex: 0,
        text: "Test",
        type: "evidence",
      };

      const formatted = formatter.formatCitation(citation, "footnote", 1);

      expect(formatted.transcriptUrl).toBe("/sessions/abc#msg-0");
    });
  });
});
