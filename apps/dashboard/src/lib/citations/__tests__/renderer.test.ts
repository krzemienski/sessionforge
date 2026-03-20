/**
 * Citation Renderer Tests
 *
 * Tests for the citation renderer that combines extraction, formatting,
 * and rendering of citations in markdown content.
 */

import { describe, test, expect } from "vitest";
import {
  CitationRenderer,
  type RenderOptions,
  type CitationMetadata,
} from "../renderer";

describe("CitationRenderer", () => {
  const sampleMetadata: Record<string, CitationMetadata> = {
    "session1:5": {
      sessionId: "session1",
      messageIndex: 5,
      text: "Added JWT authentication",
      type: "file_edit",
    },
    "session2:12": {
      sessionId: "session2",
      messageIndex: 12,
      text: "Fixed CORS configuration",
      type: "tool_call",
    },
    "session3:8": {
      sessionId: "session3",
      messageIndex: 8,
      text: "Discussed security best practices",
      type: "conversation",
    },
  };

  describe("render", () => {
    describe("footnote format", () => {
      test("renders markdown with footnote citations", () => {
        const renderer = new CitationRenderer();
        const markdown =
          "We added authentication[@session1:5] and fixed CORS[@session2:12] issues.";

        const result = renderer.render(markdown, sampleMetadata, {
          format: "footnote",
        });

        expect(result.content).toBe(
          "We added authentication[1] and fixed CORS[2] issues."
        );
        expect(result.references).toContain("## References");
        expect(result.references).toContain("1. [File Edit]");
        expect(result.references).toContain("2. [Tool Call]");
        expect(result.citations).toHaveLength(2);
      });

      test("includes references section in output", () => {
        const renderer = new CitationRenderer();
        const markdown = "Security discussion[@session3:8] was helpful.";

        const result = renderer.render(markdown, sampleMetadata, {
          format: "footnote",
        });

        expect(result.references).toContain("## References");
        expect(result.references).toContain(
          "1. [Conversation] Discussed security best practices"
        );
        expect(result.references).toContain("/sessions/session3#msg-8");
      });

      test("handles custom base URL", () => {
        const renderer = new CitationRenderer();
        const markdown = "Added auth[@session1:5] module.";

        const result = renderer.render(markdown, sampleMetadata, {
          format: "footnote",
          baseUrl: "/workspace/sessions",
        });

        expect(result.references).toContain(
          "/workspace/sessions/session1#msg-5"
        );
      });
    });

    describe("inline format", () => {
      test("renders markdown with inline citation links", () => {
        const renderer = new CitationRenderer();
        const markdown = "Fixed CORS[@session2:12] issues today.";

        const result = renderer.render(markdown, sampleMetadata, {
          format: "inline",
        });

        expect(result.content).toContain("Fixed CORS");
        expect(result.content).toContain("[[Tool Call]]");
        expect(result.content).toContain("/sessions/session2#msg-12");
        expect(result.references).toBe("");
      });

      test("hides type labels when requested", () => {
        const renderer = new CitationRenderer();
        const markdown = "Added auth[@session1:5] module.";

        const result = renderer.render(markdown, sampleMetadata, {
          format: "inline",
          includeTypeLabel: false,
        });

        expect(result.content).toContain("[[View source]]");
        expect(result.content).not.toContain("File Edit");
      });
    });

    describe("card format", () => {
      test("renders markdown with expandable citation cards", () => {
        const renderer = new CitationRenderer();
        const markdown = "We discussed security[@session3:8] at length.";

        const result = renderer.render(markdown, sampleMetadata, {
          format: "card",
        });

        expect(result.content).toContain("We discussed security");
        expect(result.content).toContain("<details>");
        expect(result.content).toContain("Conversation");
        expect(result.content).toContain(
          "Discussed security best practices"
        );
        expect(result.references).toBe("");
      });

      test("respects maxPreviewChars option", () => {
        const renderer = new CitationRenderer();
        const longMetadata: Record<string, CitationMetadata> = {
          "long:1": {
            sessionId: "long",
            messageIndex: 1,
            text: "This is a very long citation text that should be truncated when displayed in the card summary to avoid overwhelming the user with too much information at once",
            type: "evidence",
          },
        };
        const markdown = "Long citation[@long:1] here.";

        const result = renderer.render(markdown, longMetadata, {
          format: "card",
          maxPreviewChars: 30,
        });

        const summaryMatch = result.content.match(/<summary>.*?<\/summary>/s);
        expect(summaryMatch).toBeTruthy();
        expect(summaryMatch![0]).toContain("...");
      });
    });

    describe("edge cases", () => {
      test("handles markdown with no citations", () => {
        const renderer = new CitationRenderer();
        const markdown = "This is plain markdown without any citations.";

        const result = renderer.render(markdown, sampleMetadata, {
          format: "footnote",
        });

        expect(result.content).toBe(markdown);
        expect(result.references).toBe("");
        expect(result.citations).toEqual([]);
      });

      test("handles citation markers without metadata", () => {
        const renderer = new CitationRenderer();
        const markdown = "Missing citation[@missing:1] here.";

        const result = renderer.render(markdown, sampleMetadata, {
          format: "footnote",
        });

        // Citation marker should remain unchanged if no metadata found
        expect(result.content).toBe(markdown);
        expect(result.citations).toHaveLength(0);
      });

      test("preserves code blocks with citation-like syntax", () => {
        const renderer = new CitationRenderer();
        const markdown = `Code example:
\`\`\`
// This is not a citation: [@session1:5]
const x = 1;
\`\`\`
Real citation[@session1:5] here.`;

        const result = renderer.render(markdown, sampleMetadata, {
          format: "footnote",
        });

        expect(result.content).toContain("[@session1:5]"); // In code block
        expect(result.content).toContain("[1]"); // Actual citation
        expect(result.citations).toHaveLength(1);
      });

      test("preserves inline code with citation-like syntax", () => {
        const renderer = new CitationRenderer();
        const markdown =
          "Use `[@session1:5]` in code but not in text[@session1:5].";

        const result = renderer.render(markdown, sampleMetadata, {
          format: "footnote",
        });

        expect(result.content).toContain("`[@session1:5]`"); // In inline code
        expect(result.content).toContain("[1]"); // Actual citation
        expect(result.citations).toHaveLength(1);
      });

      test("handles multiple occurrences of same citation", () => {
        const renderer = new CitationRenderer();
        const markdown =
          "First[@session1:5] and second[@session1:5] reference.";

        const result = renderer.render(markdown, sampleMetadata, {
          format: "footnote",
        });

        expect(result.content).toBe("First[1] and second[1] reference.");
        expect(result.citations).toHaveLength(1);
      });

      test("preserves markdown formatting around citations", () => {
        const renderer = new CitationRenderer();
        const markdown =
          "**Bold[@session1:5]** and *italic[@session2:12]* text.";

        const result = renderer.render(markdown, sampleMetadata, {
          format: "footnote",
        });

        expect(result.content).toContain("**Bold[1]**");
        expect(result.content).toContain("*italic[2]*");
      });
    });

    describe("options validation", () => {
      test("defaults to footnote format", () => {
        const renderer = new CitationRenderer();
        const markdown = "Citation[@session1:5] here.";

        const result = renderer.render(markdown, sampleMetadata);

        expect(result.content).toContain("[1]");
        expect(result.references).toContain("## References");
      });

      test("uses default base URL when not specified", () => {
        const renderer = new CitationRenderer();
        const markdown = "Citation[@session1:5] here.";

        const result = renderer.render(markdown, sampleMetadata, {
          format: "footnote",
        });

        expect(result.citations[0].transcriptUrl).toBe(
          "/sessions/session1#msg-5"
        );
      });
    });
  });

  describe("renderWithMetadataLookup", () => {
    test("looks up citation metadata dynamically", () => {
      const renderer = new CitationRenderer();
      const markdown = "Citation[@session1:5] and another[@session2:12].";

      const lookupFn = (sessionId: string, messageIndex: number) => {
        const key = `${sessionId}:${messageIndex}`;
        return sampleMetadata[key] || null;
      };

      const result = renderer.renderWithMetadataLookup(
        markdown,
        lookupFn,
        { format: "footnote" }
      );

      expect(result.content).toBe("Citation[1] and another[2].");
      expect(result.citations).toHaveLength(2);
    });

    test("skips citations when lookup returns null", () => {
      const renderer = new CitationRenderer();
      const markdown = "Citation[@session1:5] and missing[@missing:99].";

      const lookupFn = (sessionId: string, messageIndex: number) => {
        const key = `${sessionId}:${messageIndex}`;
        return sampleMetadata[key] || null;
      };

      const result = renderer.renderWithMetadataLookup(
        markdown,
        lookupFn,
        { format: "footnote" }
      );

      expect(result.content).toContain("Citation[1]");
      expect(result.content).toContain("missing[@missing:99]");
      expect(result.citations).toHaveLength(1);
    });
  });

  describe("getFullOutput", () => {
    test("combines content and references for footnote format", () => {
      const renderer = new CitationRenderer();
      const markdown = "Citation[@session1:5] here.";

      const result = renderer.render(markdown, sampleMetadata, {
        format: "footnote",
      });
      const fullOutput = renderer.getFullOutput(result);

      expect(fullOutput).toContain("Citation[1] here.");
      expect(fullOutput).toContain("\n\n## References\n");
      expect(fullOutput).toContain(
        "1. [File Edit] Added JWT authentication"
      );
    });

    test("returns only content for non-footnote formats", () => {
      const renderer = new CitationRenderer();
      const markdown = "Citation[@session1:5] here.";

      const result = renderer.render(markdown, sampleMetadata, {
        format: "inline",
      });
      const fullOutput = renderer.getFullOutput(result);

      expect(fullOutput).toContain("[[File Edit]]");
      expect(fullOutput).not.toContain("## References");
    });

    test("handles result with no citations", () => {
      const renderer = new CitationRenderer();
      const markdown = "No citations here.";

      const result = renderer.render(markdown, sampleMetadata, {
        format: "footnote",
      });
      const fullOutput = renderer.getFullOutput(result);

      expect(fullOutput).toBe("No citations here.");
    });
  });
});
