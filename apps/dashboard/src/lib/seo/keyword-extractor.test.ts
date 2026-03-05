import { describe, it, expect } from "bun:test";
import {
  extractKeywords,
  extractKeywordsFromSources,
  stripMarkdown,
  tokenize,
  type ExtractedKeyword,
} from "./keyword-extractor";

describe("stripMarkdown", () => {
  it("removes fenced code blocks", () => {
    const input = "Here is some text\n```typescript\nconst x = 1;\n```\nMore text";
    const result = stripMarkdown(input);
    expect(result).not.toContain("const x = 1");
    expect(result).toContain("Here is some text");
    expect(result).toContain("More text");
  });

  it("removes inline code", () => {
    const result = stripMarkdown("Use `npm install` to install packages");
    expect(result).not.toContain("`");
    expect(result).toContain("Use");
    expect(result).toContain("to install packages");
  });

  it("removes markdown headings", () => {
    const result = stripMarkdown("# Introduction\n## Getting Started");
    expect(result).not.toContain("#");
    expect(result).toContain("Introduction");
    expect(result).toContain("Getting Started");
  });

  it("keeps link text but removes URL", () => {
    const result = stripMarkdown("[Click here](https://example.com)");
    expect(result).toContain("Click here");
    expect(result).not.toContain("https://example.com");
  });

  it("removes bold and italic markers", () => {
    const result = stripMarkdown("**bold text** and *italic text* and ***both***");
    expect(result).not.toContain("*");
    expect(result).toContain("bold text");
    expect(result).toContain("italic text");
  });

  it("handles empty string", () => {
    expect(stripMarkdown("")).toBe("");
  });
});

describe("tokenize", () => {
  it("splits text into lowercase tokens", () => {
    const tokens = tokenize("Hello World TypeScript");
    expect(tokens).toContain("hello");
    expect(tokens).toContain("world");
    expect(tokens).toContain("typescript");
  });

  it("filters out stop words", () => {
    const tokens = tokenize("the quick and brown fox");
    expect(tokens).not.toContain("the");
    expect(tokens).not.toContain("and");
    expect(tokens).toContain("quick");
    expect(tokens).toContain("brown");
    expect(tokens).toContain("fox");
  });

  it("filters tokens shorter than 3 characters", () => {
    const tokens = tokenize("an is it at to");
    // all are stop words AND short
    expect(tokens).toHaveLength(0);
  });

  it("handles punctuation correctly", () => {
    const tokens = tokenize("React.js, TypeScript, and Node.js!");
    expect(tokens).toContain("react");
    expect(tokens).toContain("typescript");
    expect(tokens).toContain("node");
  });
});

describe("extractKeywords", () => {
  const sampleMarkdown = `
# Building a REST API with TypeScript

TypeScript is a typed superset of JavaScript that compiles to plain JavaScript.
When building REST APIs, TypeScript provides excellent type safety and developer experience.

## Getting Started with TypeScript

First, install TypeScript using npm:

\`\`\`bash
npm install typescript --save-dev
\`\`\`

TypeScript configuration is managed through tsconfig.json. The TypeScript compiler
will type-check your code and provide helpful error messages.

## REST API Design Patterns

REST APIs should follow consistent patterns. Using TypeScript with Express.js
creates a powerful combination for building scalable REST APIs.

TypeScript interfaces define the shape of your data, ensuring type safety
throughout your REST API application.
  `;

  it("returns an array of ExtractedKeyword objects", () => {
    const keywords = extractKeywords(sampleMarkdown);
    expect(Array.isArray(keywords)).toBe(true);
    keywords.forEach((kw) => {
      expect(kw).toHaveProperty("keyword");
      expect(kw).toHaveProperty("relevance");
      expect(kw).toHaveProperty("frequency");
      expect(typeof kw.keyword).toBe("string");
      expect(typeof kw.relevance).toBe("number");
      expect(typeof kw.frequency).toBe("number");
    });
  });

  it("identifies high-frequency terms with high relevance", () => {
    const keywords = extractKeywords(sampleMarkdown);
    // "typescript" appears many times - should be near top
    const typescript = keywords.find((k) => k.keyword === "typescript");
    expect(typescript).toBeDefined();
    expect(typescript!.frequency).toBeGreaterThan(2);
    expect(typescript!.relevance).toBeGreaterThan(0.5);
  });

  it("returns keywords sorted by relevance descending", () => {
    const keywords = extractKeywords(sampleMarkdown);
    for (let i = 1; i < keywords.length; i++) {
      expect(keywords[i - 1].relevance).toBeGreaterThanOrEqual(keywords[i].relevance);
    }
  });

  it("relevance scores are between 0 and 1", () => {
    const keywords = extractKeywords(sampleMarkdown);
    keywords.forEach((kw) => {
      expect(kw.relevance).toBeGreaterThanOrEqual(0);
      expect(kw.relevance).toBeLessThanOrEqual(1);
    });
  });

  it("top keyword has relevance of 1", () => {
    const keywords = extractKeywords(sampleMarkdown);
    if (keywords.length > 0) {
      expect(keywords[0].relevance).toBe(1);
    }
  });

  it("respects maxKeywords option", () => {
    const keywords = extractKeywords(sampleMarkdown, { maxKeywords: 5 });
    expect(keywords.length).toBeLessThanOrEqual(5);
  });

  it("respects minFrequency option", () => {
    const keywords = extractKeywords(sampleMarkdown, { minFrequency: 3 });
    keywords.forEach((kw) => {
      expect(kw.frequency).toBeGreaterThanOrEqual(3);
    });
  });

  it("includes bigram phrases when includePhrases is true", () => {
    const keywords = extractKeywords(sampleMarkdown, { includePhrases: true });
    const phrases = keywords.filter((k) => k.keyword.includes(" "));
    expect(phrases.length).toBeGreaterThan(0);
  });

  it("excludes bigram phrases when includePhrases is false", () => {
    const keywords = extractKeywords(sampleMarkdown, { includePhrases: false });
    const phrases = keywords.filter((k) => k.keyword.includes(" "));
    expect(phrases).toHaveLength(0);
  });

  it("returns empty array for empty input", () => {
    expect(extractKeywords("")).toHaveLength(0);
    expect(extractKeywords("   ")).toHaveLength(0);
  });

  it("handles markdown-only content gracefully", () => {
    const markdownOnly = "# \n## \n```\n```\n---";
    const keywords = extractKeywords(markdownOnly);
    expect(Array.isArray(keywords)).toBe(true);
  });

  it("extracts keywords from code-heavy markdown", () => {
    const codeMarkdown = `
# React Component Guide

React components are the building blocks of React applications.
A React component accepts props and returns JSX elements.

\`\`\`typescript
function MyComponent({ name }: { name: string }) {
  return <div>{name}</div>;
}
\`\`\`

React hooks like useState and useEffect manage component state and side effects.
    `;
    const keywords = extractKeywords(codeMarkdown);
    const react = keywords.find((k) => k.keyword === "react");
    expect(react).toBeDefined();
    expect(react!.frequency).toBeGreaterThan(1);
  });

  it("does not include common stop words as keywords", () => {
    const keywords = extractKeywords(sampleMarkdown);
    const stopWordKeywords = keywords.filter((k) =>
      ["the", "and", "or", "is", "are", "was", "with", "for", "of", "in", "to"].includes(k.keyword)
    );
    expect(stopWordKeywords).toHaveLength(0);
  });

  it("handles short content with few unique words", () => {
    const shortContent = "TypeScript TypeScript TypeScript is great for developers.";
    const keywords = extractKeywords(shortContent);
    expect(keywords.length).toBeGreaterThan(0);
    const typescript = keywords.find((k) => k.keyword === "typescript");
    expect(typescript).toBeDefined();
    expect(typescript!.frequency).toBe(3);
  });
});

describe("extractKeywordsFromSources", () => {
  it("combines multiple sources into unified keyword list", () => {
    const sources = [
      "TypeScript is a typed language for JavaScript development",
      "JavaScript developers love TypeScript for its type safety features",
    ];
    const keywords = extractKeywordsFromSources(sources);
    expect(Array.isArray(keywords)).toBe(true);

    const typescript = keywords.find((k) => k.keyword === "typescript");
    expect(typescript).toBeDefined();
    expect(typescript!.frequency).toBeGreaterThan(1);
  });

  it("handles empty sources array", () => {
    const keywords = extractKeywordsFromSources([]);
    expect(keywords).toHaveLength(0);
  });

  it("handles array with empty strings", () => {
    const keywords = extractKeywordsFromSources(["", "  ", ""]);
    expect(keywords).toHaveLength(0);
  });

  it("returns keywords from single source", () => {
    const keywords = extractKeywordsFromSources([
      "React is a JavaScript library for building user interfaces and components",
    ]);
    expect(keywords.length).toBeGreaterThan(0);
  });

  it("passes options through to extraction", () => {
    const sources = [
      "TypeScript React JavaScript developer tools configuration environment",
    ];
    const keywords = extractKeywordsFromSources(sources, { maxKeywords: 3 });
    expect(keywords.length).toBeLessThanOrEqual(3);
  });
});
