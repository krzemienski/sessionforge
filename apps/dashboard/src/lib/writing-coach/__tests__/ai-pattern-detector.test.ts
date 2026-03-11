import { describe, it, expect } from "vitest";
import { detectAiPatterns, AI_PATTERN_DICTIONARY } from "../ai-pattern-detector";

describe("AI Pattern Detector", () => {
  describe("detectAiPatterns", () => {
    it("should detect hedge-words category", () => {
      const text = "We must delve into this issue and leverage our resources.";
      const matches = detectAiPatterns(text);

      const hedgeMatches = matches.filter(m => m.category === "hedge-words");
      expect(hedgeMatches.length).toBeGreaterThan(0);
      expect(hedgeMatches.some(m => m.phrase.toLowerCase().includes("delve"))).toBe(true);
      expect(hedgeMatches.some(m => m.phrase.toLowerCase().includes("leverage"))).toBe(true);
    });

    it("should detect filler-phrases category", () => {
      const text = "It is important to note that in conclusion we succeeded.";
      const matches = detectAiPatterns(text);

      const fillerMatches = matches.filter(m => m.category === "filler-phrases");
      expect(fillerMatches.length).toBeGreaterThan(0);
    });

    it("should detect corporate-speak category", () => {
      const text = "This paradigm shift creates synergy in the ecosystem.";
      const matches = detectAiPatterns(text);

      const corporateMatches = matches.filter(m => m.category === "corporate-speak");
      expect(corporateMatches.length).toBeGreaterThan(0);
    });

    it("should detect ai-signatures category", () => {
      const text = "Certainly! I hope this helps. Feel free to ask.";
      const matches = detectAiPatterns(text);

      const signatureMatches = matches.filter(m => m.category === "ai-signatures");
      expect(signatureMatches.length).toBeGreaterThan(0);
    });

    it("should be case-insensitive", () => {
      const text1 = "DELVE into this";
      const text2 = "delve into this";

      expect(detectAiPatterns(text1).length).toBe(detectAiPatterns(text2).length);
    });

    it("should track positions correctly", () => {
      const text = "We must delve into this issue.";
      const matches = detectAiPatterns(text);

      const delveMatch = matches.find(m => m.phrase.toLowerCase().includes("delve"));
      expect(delveMatch).toBeDefined();
      expect(delveMatch!.startIndex).toBeGreaterThanOrEqual(0);
      expect(delveMatch!.endIndex).toBeGreaterThan(delveMatch!.startIndex);
      expect(text.slice(delveMatch!.startIndex, delveMatch!.endIndex).toLowerCase()).toContain("delve");
    });

    it("should provide suggestions for all matches", () => {
      const text = "We must delve into this.";
      const matches = detectAiPatterns(text);

      matches.forEach(match => {
        expect(match.suggestion).toBeDefined();
        expect(match.suggestion.length).toBeGreaterThan(0);
      });
    });

    it("should handle empty text", () => {
      expect(detectAiPatterns("")).toEqual([]);
    });

    it("should handle text with no patterns", () => {
      const text = "This is clean technical writing.";
      const matches = detectAiPatterns(text);
      expect(matches.length).toBe(0);
    });

    it("should detect at least 30 total phrases in dictionary", () => {
      const totalPhrases = AI_PATTERN_DICTIONARY.length;
      expect(totalPhrases).toBeGreaterThanOrEqual(30);
    });
  });
});
