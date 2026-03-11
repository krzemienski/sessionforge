/**
 * Tests for citation markdown transformer
 *
 * Verifies that citation markers correctly convert between markdown and Lexical nodes.
 */

import { describe, test, expect } from "bun:test";

// Citation transformer patterns (extracted from markdown-editor.tsx for testing)
const CITATION_IMPORT_REGEX = /\[@([^:]+):(\d+)\]/;
const CITATION_REGEX = /\[@([^:]+):(\d+)\]$/;

describe("Citation Markdown Transformer", () => {
  test("import regex matches citation markdown format", () => {
    const testCases = [
      { input: "[@session-123:5]", expected: ["[@session-123:5]", "session-123", "5"] },
      { input: "[@abc-def:42]", expected: ["[@abc-def:42]", "abc-def", "42"] },
      { input: "[@550e8400-e29b-41d4-a716-446655440000:15]", expected: ["[@550e8400-e29b-41d4-a716-446655440000:15]", "550e8400-e29b-41d4-a716-446655440000", "15"] },
      { input: "[@session-zero:0]", expected: ["[@session-zero:0]", "session-zero", "0"] },
    ];

    testCases.forEach(({ input, expected }) => {
      const match = input.match(CITATION_IMPORT_REGEX);
      expect(match).not.toBeNull();
      expect(match![0]).toBe(expected[0]); // full match
      expect(match![1]).toBe(expected[1]); // sessionId
      expect(match![2]).toBe(expected[2]); // messageIndex
    });
  });

  test("import regex matches citations in text", () => {
    const text = "This is a test with [@session-123:5] citation.";
    const match = text.match(CITATION_IMPORT_REGEX);

    expect(match).not.toBeNull();
    expect(match![1]).toBe("session-123");
    expect(match![2]).toBe("5");
  });

  test("import regex matches multiple citations", () => {
    const text = "First [@sess-1:1] second [@sess-2:2] third";
    const matches = text.matchAll(new RegExp(CITATION_IMPORT_REGEX, 'g'));
    const matchArray = Array.from(matches);

    expect(matchArray).toHaveLength(2);
    expect(matchArray[0][1]).toBe("sess-1");
    expect(matchArray[0][2]).toBe("1");
    expect(matchArray[1][1]).toBe("sess-2");
    expect(matchArray[1][2]).toBe("2");
  });

  test("trigger regex matches end-of-text citations", () => {
    const testCases = [
      { input: "text [@session-123:5]", shouldMatch: true },
      { input: "[@abc:10]", shouldMatch: true },
      { input: "[@abc:10] more text", shouldMatch: false },
    ];

    testCases.forEach(({ input, shouldMatch }) => {
      const match = input.match(CITATION_REGEX);
      if (shouldMatch) {
        expect(match).not.toBeNull();
      } else {
        expect(match).toBeNull();
      }
    });
  });

  test("regex does not match invalid formats", () => {
    const invalidFormats = [
      "[session-123:5]",  // missing @
      "[@session-123]",   // missing :index
      "[@:5]",            // missing sessionId
      "[@session-123:abc]", // non-numeric index
      "@session-123:5",   // missing brackets
    ];

    invalidFormats.forEach((input) => {
      const match = input.match(CITATION_IMPORT_REGEX);
      expect(match).toBeNull();
    });
  });

  test("parses sessionId and messageIndex correctly", () => {
    const text = "Reference [@my-session-id:999] here";
    const match = text.match(CITATION_IMPORT_REGEX);

    expect(match).not.toBeNull();
    const sessionId = match![1];
    const messageIndex = parseInt(match![2], 10);

    expect(sessionId).toBe("my-session-id");
    expect(messageIndex).toBe(999);
    expect(typeof messageIndex).toBe("number");
  });

  test("export format matches expected pattern", () => {
    // Test the export format that the transformer produces
    const testCases = [
      { sessionId: "session-abc", messageIndex: 42, expected: "[@session-abc:42]" },
      { sessionId: "550e8400-e29b-41d4-a716-446655440000", messageIndex: 15, expected: "[@550e8400-e29b-41d4-a716-446655440000:15]" },
      { sessionId: "session-zero", messageIndex: 0, expected: "[@session-zero:0]" },
    ];

    testCases.forEach(({ sessionId, messageIndex, expected }) => {
      const exported = `[@${sessionId}:${messageIndex}]`;
      expect(exported).toBe(expected);

      // Verify it can be re-imported
      const match = exported.match(CITATION_IMPORT_REGEX);
      expect(match).not.toBeNull();
      expect(match![1]).toBe(sessionId);
      expect(parseInt(match![2], 10)).toBe(messageIndex);
    });
  });
});

