import { describe, it, expect } from "bun:test";
import {
  scoreReadability,
  stripMarkdownForReadability,
  splitIntoSentences,
  splitIntoWords,
  countSyllables,
  getReadingLevel,
  type ReadabilityScore,
  type ReadingLevel,
} from "./readability-scorer";

describe("stripMarkdownForReadability", () => {
  it("removes fenced code blocks", () => {
    const input = "Here is some text\n```typescript\nconst x = 1;\n```\nMore text here.";
    const result = stripMarkdownForReadability(input);
    expect(result).not.toContain("const x = 1");
    expect(result).toContain("Here is some text");
    expect(result).toContain("More text here");
  });

  it("removes inline code", () => {
    const result = stripMarkdownForReadability("Use `npm install` to install packages.");
    expect(result).not.toContain("`");
    expect(result).toContain("Use");
    expect(result).toContain("to install packages");
  });

  it("removes markdown headings", () => {
    const result = stripMarkdownForReadability("# Introduction\n## Getting Started\nContent here.");
    expect(result).not.toContain("#");
    expect(result).toContain("Introduction");
    expect(result).toContain("Content here");
  });

  it("keeps link text but removes URL", () => {
    const result = stripMarkdownForReadability("[Click here](https://example.com) for more.");
    expect(result).toContain("Click here");
    expect(result).not.toContain("https://example.com");
  });

  it("removes bold and italic markers", () => {
    const result = stripMarkdownForReadability("**bold text** and *italic text*.");
    expect(result).not.toContain("*");
    expect(result).toContain("bold text");
    expect(result).toContain("italic text");
  });

  it("handles empty string", () => {
    expect(stripMarkdownForReadability("")).toBe("");
  });

  it("collapses whitespace", () => {
    const result = stripMarkdownForReadability("word1   word2\n\n\nword3");
    expect(result).toBe("word1 word2 word3");
  });
});

describe("splitIntoSentences", () => {
  it("splits text on periods", () => {
    const sentences = splitIntoSentences("First sentence. Second sentence. Third sentence.");
    expect(sentences.length).toBeGreaterThanOrEqual(3);
  });

  it("splits on question marks", () => {
    const sentences = splitIntoSentences("Is this a test? Yes it is. It works.");
    expect(sentences.length).toBeGreaterThanOrEqual(2);
  });

  it("splits on exclamation marks", () => {
    const sentences = splitIntoSentences("Wow, this is great! It really works well.");
    expect(sentences.length).toBeGreaterThanOrEqual(2);
  });

  it("returns empty array for empty input", () => {
    expect(splitIntoSentences("")).toHaveLength(0);
    expect(splitIntoSentences("   ")).toHaveLength(0);
  });

  it("returns single sentence for single sentence input", () => {
    const sentences = splitIntoSentences("This is a single sentence with no period");
    expect(sentences.length).toBe(1);
  });

  it("handles text without trailing period", () => {
    const sentences = splitIntoSentences("First sentence. Second sentence without period");
    expect(sentences.length).toBeGreaterThanOrEqual(1);
  });
});

describe("splitIntoWords", () => {
  it("splits text into words", () => {
    const words = splitIntoWords("Hello world test");
    expect(words).toContain("Hello");
    expect(words).toContain("world");
    expect(words).toContain("test");
  });

  it("strips leading and trailing punctuation", () => {
    const words = splitIntoWords("Hello, world! This is a test.");
    expect(words).toContain("Hello");
    expect(words).toContain("world");
    expect(words).not.toContain("Hello,");
    expect(words).not.toContain("world!");
  });

  it("filters out punctuation-only tokens", () => {
    const words = splitIntoWords("Hello ... world --- test");
    expect(words).toContain("Hello");
    expect(words).toContain("world");
    expect(words).toContain("test");
    expect(words).not.toContain("...");
    expect(words).not.toContain("---");
  });

  it("returns empty array for empty input", () => {
    expect(splitIntoWords("")).toHaveLength(0);
  });

  it("handles words with hyphens", () => {
    const words = splitIntoWords("well-known state-of-the-art solution");
    expect(words.length).toBeGreaterThan(0);
  });
});

describe("countSyllables", () => {
  it("counts syllables for simple words", () => {
    expect(countSyllables("cat")).toBe(1);
    expect(countSyllables("dog")).toBe(1);
    expect(countSyllables("run")).toBe(1);
  });

  it("counts syllables for two-syllable words", () => {
    expect(countSyllables("table")).toBe(2);
    expect(countSyllables("under")).toBe(2);
  });

  it("counts syllables for three-syllable words", () => {
    expect(countSyllables("beautiful")).toBe(3);
    expect(countSyllables("computer")).toBe(3);
  });

  it("returns minimum of 1 for any non-empty word", () => {
    expect(countSyllables("a")).toBeGreaterThanOrEqual(1);
    expect(countSyllables("z")).toBeGreaterThanOrEqual(1);
  });

  it("handles words with uppercase", () => {
    const lower = countSyllables("example");
    const upper = countSyllables("EXAMPLE");
    expect(lower).toBe(upper);
  });

  it("returns 0 for empty string", () => {
    expect(countSyllables("")).toBe(0);
  });
});

describe("getReadingLevel", () => {
  it("returns very-easy for scores 90 and above", () => {
    expect(getReadingLevel(95)).toBe("very-easy");
    expect(getReadingLevel(90)).toBe("very-easy");
  });

  it("returns easy for scores 80-89", () => {
    expect(getReadingLevel(85)).toBe("easy");
    expect(getReadingLevel(80)).toBe("easy");
  });

  it("returns fairly-easy for scores 70-79", () => {
    expect(getReadingLevel(75)).toBe("fairly-easy");
    expect(getReadingLevel(70)).toBe("fairly-easy");
  });

  it("returns standard for scores 60-69", () => {
    expect(getReadingLevel(65)).toBe("standard");
    expect(getReadingLevel(60)).toBe("standard");
  });

  it("returns fairly-difficult for scores 50-59", () => {
    expect(getReadingLevel(55)).toBe("fairly-difficult");
    expect(getReadingLevel(50)).toBe("fairly-difficult");
  });

  it("returns difficult for scores 30-49", () => {
    expect(getReadingLevel(40)).toBe("difficult");
    expect(getReadingLevel(30)).toBe("difficult");
  });

  it("returns very-difficult for scores below 30", () => {
    expect(getReadingLevel(20)).toBe("very-difficult");
    expect(getReadingLevel(0)).toBe("very-difficult");
  });
});

describe("scoreReadability", () => {
  const simpleText = `
The cat sat on the mat. It was a nice day. The sun shone bright.
Dogs ran in the park. Birds sang in the trees.
  `;

  const complexText = `
Contemporary computational architectures necessitate sophisticated optimization methodologies
to accommodate increasingly heterogeneous workloads. The proliferation of distributed
processing environments has fundamentally transformed organizational infrastructure requirements,
compelling practitioners to reconceptualize traditional deployment strategies.
Multidimensional performance considerations encompass availability, scalability, and maintainability.
  `;

  it("returns a ReadabilityScore object with required fields", () => {
    const result = scoreReadability(simpleText);
    expect(result).toHaveProperty("score");
    expect(result).toHaveProperty("gradeLevel");
    expect(result).toHaveProperty("readingLevel");
    expect(result).toHaveProperty("wordCount");
    expect(result).toHaveProperty("sentenceCount");
    expect(result).toHaveProperty("averageSentenceLength");
    expect(result).toHaveProperty("averageSyllablesPerWord");
    expect(result).toHaveProperty("suggestions");
  });

  it("score is a number between 0 and 100", () => {
    const result = scoreReadability(simpleText);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("grade level is a non-negative number", () => {
    const result = scoreReadability(simpleText);
    expect(result.gradeLevel).toBeGreaterThanOrEqual(0);
  });

  it("simple text scores higher (easier) than complex text", () => {
    const simpleResult = scoreReadability(simpleText);
    const complexResult = scoreReadability(complexText);
    expect(simpleResult.score).toBeGreaterThan(complexResult.score);
  });

  it("complex text has higher grade level than simple text", () => {
    const simpleResult = scoreReadability(simpleText);
    const complexResult = scoreReadability(complexText);
    expect(complexResult.gradeLevel).toBeGreaterThan(simpleResult.gradeLevel);
  });

  it("simple text has very-easy or easy reading level", () => {
    const result = scoreReadability(simpleText);
    const easyLevels: ReadingLevel[] = ["very-easy", "easy", "fairly-easy"];
    expect(easyLevels).toContain(result.readingLevel);
  });

  it("complex text has difficult reading level", () => {
    const result = scoreReadability(complexText);
    const hardLevels: ReadingLevel[] = ["difficult", "very-difficult", "fairly-difficult"];
    expect(hardLevels).toContain(result.readingLevel);
  });

  it("word count matches actual words in content", () => {
    const text = "One two three four five.";
    const result = scoreReadability(text);
    expect(result.wordCount).toBe(5);
  });

  it("counts sentences correctly", () => {
    const text = "First sentence. Second sentence. Third sentence.";
    const result = scoreReadability(text);
    expect(result.sentenceCount).toBeGreaterThanOrEqual(3);
  });

  it("returns zero score for empty input", () => {
    const result = scoreReadability("");
    expect(result.score).toBe(0);
    expect(result.wordCount).toBe(0);
    expect(result.sentenceCount).toBe(0);
  });

  it("returns zero score for whitespace-only input", () => {
    const result = scoreReadability("   \n\n  ");
    expect(result.score).toBe(0);
    expect(result.wordCount).toBe(0);
  });

  it("suggestions is an array", () => {
    const result = scoreReadability(simpleText);
    expect(Array.isArray(result.suggestions)).toBe(true);
  });

  it("each suggestion has type, message, and severity", () => {
    const result = scoreReadability(complexText);
    for (const suggestion of result.suggestions) {
      expect(suggestion).toHaveProperty("type");
      expect(suggestion).toHaveProperty("message");
      expect(suggestion).toHaveProperty("severity");
      expect(typeof suggestion.message).toBe("string");
      expect(["low", "medium", "high"]).toContain(suggestion.severity);
    }
  });

  it("ignores markdown code blocks in word count", () => {
    const markdownWithCode = `
This is prose text.

\`\`\`typescript
const x = 1;
const y = 2;
const z = x + y;
\`\`\`

More prose text here.
    `;
    const result = scoreReadability(markdownWithCode);
    // Code block contents should not inflate word count dramatically
    const proseOnly = scoreReadability("This is prose text. More prose text here.");
    // Word counts should be similar (within ~10 words tolerance)
    expect(Math.abs(result.wordCount - proseOnly.wordCount)).toBeLessThan(10);
  });

  it("handles markdown formatting correctly", () => {
    const markdownContent = `
# Article Title

This is **bold** and *italic* text. The [link](https://example.com) leads somewhere.

## Section Heading

More content with \`inline code\` here.
    `;
    const result = scoreReadability(markdownContent);
    expect(result.wordCount).toBeGreaterThan(0);
    expect(result.score).toBeGreaterThan(0);
  });

  it("generates sentence length suggestion for very long average sentences", () => {
    const longSentenceText =
      "This is an extraordinarily lengthy sentence that continues on and on with many words strung together in a manner that most readers would find quite difficult to follow and comprehend without losing track of the original point. " +
      "Another very long sentence that contains numerous clauses and subclauses and additional information that piles on relentlessly without ever giving the reader a chance to pause and absorb what has been said so far in this text.";
    const result = scoreReadability(longSentenceText);
    const sentenceSuggestions = result.suggestions.filter((s) => s.type === "sentence-length");
    expect(sentenceSuggestions.length).toBeGreaterThan(0);
  });

  it("generates passive voice suggestion for passive-heavy text", () => {
    const passiveText =
      "The report was written by the team. The code was reviewed by the manager. " +
      "The tests were run by the CI system. The deployment was performed by the operator. " +
      "The results were recorded by the system. The data was processed by the engine.";
    const result = scoreReadability(passiveText);
    const passiveSuggestions = result.suggestions.filter((s) => s.type === "passive-voice");
    expect(passiveSuggestions.length).toBeGreaterThan(0);
  });

  it("average sentence length is correct", () => {
    // "One two three." = 3 words, "Four five." = 2 words -> avg = 2.5
    const text = "One two three. Four five.";
    const result = scoreReadability(text);
    expect(result.averageSentenceLength).toBe(2.5);
  });

  it("average syllables per word is between 1 and 5", () => {
    const result = scoreReadability(simpleText);
    expect(result.averageSyllablesPerWord).toBeGreaterThanOrEqual(1);
    expect(result.averageSyllablesPerWord).toBeLessThanOrEqual(5);
  });

  it("handles single sentence content", () => {
    const singleSentence = "TypeScript is a typed superset of JavaScript.";
    const result = scoreReadability(singleSentence);
    expect(result.sentenceCount).toBe(1);
    expect(result.wordCount).toBeGreaterThan(0);
    expect(result.score).toBeGreaterThan(0);
  });

  it("handles content with only heading-style text", () => {
    const headingsOnly = "# Introduction\n## Getting Started\n### Prerequisites";
    const result = scoreReadability(headingsOnly);
    expect(result).toBeDefined();
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});
