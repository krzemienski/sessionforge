import { describe, it, expect } from "vitest";
import { calculateVocabDiversity } from "../vocab-diversity";

describe("Vocabulary Diversity", () => {
  describe("calculateVocabDiversity", () => {
    it("should return 1.0 for all unique words", () => {
      const text = "The quick brown fox jumps over lazy dog";
      const diversity = calculateVocabDiversity(text);
      expect(diversity).toBe(1.0);
    });

    it("should return lower score for repeated words", () => {
      const text = "the the the the the the the the";
      const diversity = calculateVocabDiversity(text);
      expect(diversity).toBeCloseTo(1 / 8, 2);
    });

    it("should be case-insensitive", () => {
      const text1 = "The the THE ThE";
      const text2 = "the the the the";
      expect(calculateVocabDiversity(text1)).toBe(calculateVocabDiversity(text2));
    });

    it("should handle empty text", () => {
      expect(calculateVocabDiversity("")).toBe(0);
    });

    it("should handle single word", () => {
      expect(calculateVocabDiversity("word")).toBe(1.0);
    });

    it("should handle text with punctuation", () => {
      const text = "Hello, world! Hello, again.";
      const diversity = calculateVocabDiversity(text);
      expect(diversity).toBeGreaterThan(0);
      expect(diversity).toBeLessThan(1.0);
    });

    it("should return value between 0 and 1", () => {
      const texts = [
        "the the the",
        "one two three",
        "a b c d e f",
        "word word word word word",
      ];

      texts.forEach(text => {
        const diversity = calculateVocabDiversity(text);
        expect(diversity).toBeGreaterThanOrEqual(0);
        expect(diversity).toBeLessThanOrEqual(1);
      });
    });

    it("should calculate correct type-token ratio", () => {
      const text = "cat dog cat bird dog cat"; // 6 total, 3 unique
      const diversity = calculateVocabDiversity(text);
      expect(diversity).toBeCloseTo(3 / 6, 2);
    });
  });
});
