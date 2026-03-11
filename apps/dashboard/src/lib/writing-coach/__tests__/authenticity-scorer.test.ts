import { describe, it, expect } from "vitest";
import { calculateAuthenticityScore, type StyleMetrics } from "../authenticity-scorer";

describe("Authenticity Scorer", () => {
  const createMetrics = (overrides?: Partial<StyleMetrics>): StyleMetrics => ({
    readabilityScore: 60,
    vocabDiversity: 0.5,
    passiveVoicePct: 15,
    aiPatternCount: 2,
    wordCount: 100,
    editDistanceRatio: 0.3,
    ...overrides,
  });

  describe("calculateAuthenticityScore", () => {
    it("should return perfect score for ideal metrics", () => {
      const metrics = createMetrics({
        readabilityScore: 80,
        vocabDiversity: 0.6,
        passiveVoicePct: 5,
        aiPatternCount: 0,
        editDistanceRatio: 0.5,
      });

      const result = calculateAuthenticityScore(metrics);
      expect(result.score).toBeGreaterThanOrEqual(90);
      expect(result.grade).toBe("A");
      expect(result.improvements.length).toBe(0);
    });

    it("should penalize high AI pattern density", () => {
      const lowPatterns = createMetrics({ aiPatternCount: 1, wordCount: 100 });
      const highPatterns = createMetrics({ aiPatternCount: 10, wordCount: 100 });

      const score1 = calculateAuthenticityScore(lowPatterns);
      const score2 = calculateAuthenticityScore(highPatterns);

      expect(score2.score).toBeLessThan(score1.score);
    });

    it("should penalize low vocabulary diversity", () => {
      const highDiversity = createMetrics({ vocabDiversity: 0.6 });
      const lowDiversity = createMetrics({ vocabDiversity: 0.2 });

      const score1 = calculateAuthenticityScore(highDiversity);
      const score2 = calculateAuthenticityScore(lowDiversity);

      expect(score2.score).toBeLessThan(score1.score);
    });

    it("should penalize high passive voice", () => {
      const lowPassive = createMetrics({ passiveVoicePct: 5 });
      const highPassive = createMetrics({ passiveVoicePct: 40 });

      const score1 = calculateAuthenticityScore(lowPassive);
      const score2 = calculateAuthenticityScore(highPassive);

      expect(score2.score).toBeLessThan(score1.score);
    });

    it("should penalize low readability", () => {
      const highReadability = createMetrics({ readabilityScore: 70 });
      const lowReadability = createMetrics({ readabilityScore: 20 });

      const score1 = calculateAuthenticityScore(highReadability);
      const score2 = calculateAuthenticityScore(lowReadability);

      expect(score2.score).toBeLessThan(score1.score);
    });

    it("should bonus high edit distance", () => {
      const lowEdit = createMetrics({ editDistanceRatio: 0.1 });
      const highEdit = createMetrics({ editDistanceRatio: 0.6 });

      const score1 = calculateAuthenticityScore(lowEdit);
      const score2 = calculateAuthenticityScore(highEdit);

      expect(score2.score).toBeGreaterThan(score1.score);
    });

    it("should assign correct grade thresholds", () => {
      expect(calculateAuthenticityScore(createMetrics({ readabilityScore: 95, vocabDiversity: 0.7, passiveVoicePct: 2, aiPatternCount: 0 })).grade).toBe("A");
      expect(calculateAuthenticityScore(createMetrics({ readabilityScore: 70, vocabDiversity: 0.45, aiPatternCount: 3, editDistanceRatio: 0.15 })).grade).toBe("B");
      expect(calculateAuthenticityScore(createMetrics({ readabilityScore: 60, vocabDiversity: 0.35, passiveVoicePct: 25, aiPatternCount: 3 })).grade).toBe("C");
      expect(calculateAuthenticityScore(createMetrics({ readabilityScore: 50, vocabDiversity: 0.3, passiveVoicePct: 30, aiPatternCount: 4 })).grade).toBe("D");
      expect(calculateAuthenticityScore(createMetrics({ readabilityScore: 20, vocabDiversity: 0.15, passiveVoicePct: 50, aiPatternCount: 15 })).grade).toBe("F");
    });

    it("should provide improvement suggestions", () => {
      const metrics = createMetrics({
        readabilityScore: 30,
        vocabDiversity: 0.2,
        passiveVoicePct: 40,
        aiPatternCount: 10,
      });

      const result = calculateAuthenticityScore(metrics);
      expect(result.improvements.length).toBeGreaterThan(0);
    });

    it("should clamp score to 0-100 range", () => {
      const worstMetrics = createMetrics({
        readabilityScore: 0,
        vocabDiversity: 0,
        passiveVoicePct: 100,
        aiPatternCount: 50,
        wordCount: 100,
        editDistanceRatio: 0,
      });

      const result = calculateAuthenticityScore(worstMetrics);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });
});
