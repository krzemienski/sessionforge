/**
 * Citation Export Tests
 *
 * Tests for markdown export with citation links in references section.
 */

import { describe, test, expect } from "bun:test";
import {
  CitationRenderer,
  type CitationMetadata,
} from "../renderer";

describe("Citation Export", () => {
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

  describe("markdown export with references", () => {
    test("exported markdown includes ## References section with citation URLs", () => {
      const renderer = new CitationRenderer();
      const markdown =
        "We added authentication[@session1:5] and fixed CORS[@session2:12] issues.";

      const result = renderer.render(markdown, sampleMetadata, {
        format: "footnote",
      });

      const fullOutput = renderer.getFullOutput(result);

      // Verify references section exists
      expect(fullOutput).toContain("## References");

      // Verify citation links are present
      expect(fullOutput).toContain("[View in session](/sessions/session1#msg-5)");
      expect(fullOutput).toContain("[View in session](/sessions/session2#msg-12)");

      // Verify complete structure
      expect(fullOutput).toContain("We added authentication[1] and fixed CORS[2] issues.");
      expect(fullOutput).toContain("1. [File Edit] Added JWT authentication - [View in session]");
      expect(fullOutput).toContain("2. [Tool Call] Fixed CORS configuration - [View in session]");
    });

    test("references section includes correct transcript URLs", () => {
      const renderer = new CitationRenderer();
      const markdown = "Security discussion[@session3:8] was helpful.";

      const result = renderer.render(markdown, sampleMetadata, {
        format: "footnote",
      });

      const fullOutput = renderer.getFullOutput(result);

      expect(fullOutput).toContain("## References");
      expect(fullOutput).toContain(
        "1. [Conversation] Discussed security best practices - [View in session](/sessions/session3#msg-8)"
      );
    });

    test("references section uses custom base URL when provided", () => {
      const renderer = new CitationRenderer();
      const markdown = "Added auth[@session1:5] module.";

      const result = renderer.render(markdown, sampleMetadata, {
        format: "footnote",
        baseUrl: "/workspace/sessions",
      });

      const fullOutput = renderer.getFullOutput(result);

      expect(fullOutput).toContain("## References");
      expect(fullOutput).toContain(
        "[View in session](/workspace/sessions/session1#msg-5)"
      );
    });

    test("exported markdown with multiple citations includes all reference links", () => {
      const renderer = new CitationRenderer();
      const markdown = `# Authentication Refactor

We started by adding JWT authentication[@session1:5] to the API.

Then we fixed CORS[@session2:12] issues that were blocking requests.

Finally, we discussed security best practices[@session3:8] as a team.`;

      const result = renderer.render(markdown, sampleMetadata, {
        format: "footnote",
      });

      const fullOutput = renderer.getFullOutput(result);

      // Verify all citations are numbered in content
      expect(fullOutput).toContain("JWT authentication[1]");
      expect(fullOutput).toContain("fixed CORS[2]");
      expect(fullOutput).toContain("security best practices[3]");

      // Verify all references are present with links
      expect(fullOutput).toContain("## References");
      expect(fullOutput).toContain("1. [File Edit]");
      expect(fullOutput).toContain("[View in session](/sessions/session1#msg-5)");
      expect(fullOutput).toContain("2. [Tool Call]");
      expect(fullOutput).toContain("[View in session](/sessions/session2#msg-12)");
      expect(fullOutput).toContain("3. [Conversation]");
      expect(fullOutput).toContain("[View in session](/sessions/session3#msg-8)");
    });

    test("exported markdown without citations has no references section", () => {
      const renderer = new CitationRenderer();
      const markdown = "This is plain markdown without any citations.";

      const result = renderer.render(markdown, sampleMetadata, {
        format: "footnote",
      });

      const fullOutput = renderer.getFullOutput(result);

      expect(fullOutput).toBe(markdown);
      expect(fullOutput).not.toContain("## References");
    });

    test("references section properly formats all citation types", () => {
      const renderer = new CitationRenderer();
      const allTypesMetadata: Record<string, CitationMetadata> = {
        "s1:1": {
          sessionId: "s1",
          messageIndex: 1,
          text: "Tool call example",
          type: "tool_call",
        },
        "s1:2": {
          sessionId: "s1",
          messageIndex: 2,
          text: "File edit example",
          type: "file_edit",
        },
        "s1:3": {
          sessionId: "s1",
          messageIndex: 3,
          text: "Conversation example",
          type: "conversation",
        },
        "s1:4": {
          sessionId: "s1",
          messageIndex: 4,
          text: "Evidence example",
          type: "evidence",
        },
      };

      const markdown =
        "Tool[@s1:1] file[@s1:2] conversation[@s1:3] evidence[@s1:4].";

      const result = renderer.render(markdown, allTypesMetadata, {
        format: "footnote",
      });

      const fullOutput = renderer.getFullOutput(result);

      // Verify all type labels are present
      expect(fullOutput).toContain("1. [Tool Call] Tool call example");
      expect(fullOutput).toContain("2. [File Edit] File edit example");
      expect(fullOutput).toContain("3. [Conversation] Conversation example");
      expect(fullOutput).toContain("4. [Evidence] Evidence example");

      // Verify all links are present
      expect(fullOutput).toContain("[View in session](/sessions/s1#msg-1)");
      expect(fullOutput).toContain("[View in session](/sessions/s1#msg-2)");
      expect(fullOutput).toContain("[View in session](/sessions/s1#msg-3)");
      expect(fullOutput).toContain("[View in session](/sessions/s1#msg-4)");
    });

    test("duplicate citations appear once in references section", () => {
      const renderer = new CitationRenderer();
      const markdown =
        "First[@session1:5] and second[@session1:5] and third[@session1:5].";

      const result = renderer.render(markdown, sampleMetadata, {
        format: "footnote",
      });

      const fullOutput = renderer.getFullOutput(result);

      // Content should have three [1] references
      expect(fullOutput).toContain("First[1] and second[1] and third[1].");

      // References section should have only one entry
      expect(fullOutput).toContain("## References");
      const referencesMatch = fullOutput.match(/\d+\. \[File Edit\]/g);
      expect(referencesMatch).toHaveLength(1);
      expect(fullOutput).toContain(
        "1. [File Edit] Added JWT authentication - [View in session](/sessions/session1#msg-5)"
      );
    });
  });

  describe("inline format (no references section)", () => {
    test("inline format does not include references section", () => {
      const renderer = new CitationRenderer();
      const markdown = "Citation[@session1:5] here.";

      const result = renderer.render(markdown, sampleMetadata, {
        format: "inline",
      });

      const fullOutput = renderer.getFullOutput(result);

      expect(fullOutput).not.toContain("## References");
      expect(fullOutput).toContain("[[File Edit]]");
      expect(fullOutput).toContain("/sessions/session1#msg-5");
    });
  });

  describe("card format (no references section)", () => {
    test("card format does not include references section", () => {
      const renderer = new CitationRenderer();
      const markdown = "Citation[@session1:5] here.";

      const result = renderer.render(markdown, sampleMetadata, {
        format: "card",
      });

      const fullOutput = renderer.getFullOutput(result);

      expect(fullOutput).not.toContain("## References");
      expect(fullOutput).toContain("<details>");
    });
  });
});
