/**
 * Writing coach analytics library barrel export.
 * Provides all style analysis functions, types, and utilities for the writing coach feature.
 */

// ── Main orchestrator ────────────────────────────────────────────────────────
export {
  analyzePostStyle,
  analyzeWorkspacePosts,
  type PostStyleAnalysis,
} from "./style-analyzer";

// ── AI pattern detection ─────────────────────────────────────────────────────
export {
  detectAiPatterns,
  AI_PATTERN_DICTIONARY,
  type AiPatternMatch,
  type AiPatternEntry,
  type AiPatternCategory,
} from "./ai-pattern-detector";

// ── Vocabulary diversity ─────────────────────────────────────────────────────
export { calculateVocabDiversity } from "./vocab-diversity";

// ── Code-to-prose ratio ──────────────────────────────────────────────────────
export {
  calculateCodeToProseRatio,
  type CodeProseRatio,
} from "./code-prose-ratio";

// ── Authenticity scoring ─────────────────────────────────────────────────────
export {
  calculateAuthenticityScore,
  getAuthenticityGrade,
  type StyleMetrics,
  type AuthenticityResult,
  type AuthenticityGrade,
} from "./authenticity-scorer";

// ── Voice consistency ────────────────────────────────────────────────────────
export {
  calculateVoiceConsistency,
  getConsistencyLevel,
  type StyleProfile,
  type VoiceConsistencyResult,
  type ConsistencyLevel,
} from "./voice-consistency";
