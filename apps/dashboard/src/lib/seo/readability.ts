export interface ReadabilityResult {
  score: number;
  grade: string;
  suggestions: string[];
}

function stripMarkdown(text: string): string {
  return (
    text
      // Remove fenced code blocks
      .replace(/```[\s\S]*?```/g, " ")
      // Remove inline code
      .replace(/`[^`]*`/g, " ")
      // Remove images
      .replace(/!\[.*?\]\(.*?\)/g, " ")
      // Remove links (keep link text)
      .replace(/\[([^\]]*)\]\(.*?\)/g, "$1")
      // Remove headings markers
      .replace(/^#{1,6}\s+/gm, "")
      // Remove bold/italic (**, __, *, _)
      .replace(/(\*{1,3}|_{1,3})(.*?)\1/g, "$2")
      // Remove blockquote markers
      .replace(/^>\s*/gm, "")
      // Remove horizontal rules
      .replace(/^[-*_]{3,}\s*$/gm, " ")
      // Remove unordered list markers
      .replace(/^[\s]*[-*+]\s+/gm, "")
      // Remove ordered list markers
      .replace(/^[\s]*\d+\.\s+/gm, "")
      // Remove HTML tags
      .replace(/<[^>]+>/g, " ")
      // Collapse whitespace
      .replace(/\s+/g, " ")
      .trim()
  );
}

function countSyllables(word: string): number {
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, "");
  if (cleaned.length === 0) return 0;
  if (cleaned.length <= 3) return 1;

  // Count vowel groups
  let count = (cleaned.match(/[aeiouy]+/g) ?? []).length;

  // Subtract silent trailing 'e'
  if (cleaned.endsWith("e") && count > 1) {
    count -= 1;
  }

  // Subtract silent 'es' and 'ed' endings
  if (cleaned.endsWith("es") || cleaned.endsWith("ed")) {
    count -= 1;
  }

  return Math.max(1, count);
}

function countSentences(text: string): number {
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return Math.max(1, sentences.length);
}

function getGradeLabel(score: number): string {
  if (score >= 90) return "Very Easy (5th grade)";
  if (score >= 80) return "Easy (6th grade)";
  if (score >= 70) return "Fairly Easy (7th grade)";
  if (score >= 60) return "Standard (8th–9th grade)";
  if (score >= 50) return "Fairly Difficult (10th–12th grade)";
  if (score >= 30) return "Difficult (College)";
  return "Very Confusing (College Graduate)";
}

function getSuggestions(score: number, words: number, sentences: number): string[] {
  const suggestions: string[] = [];
  const avgWordsPerSentence = words / sentences;

  if (score < 30) {
    suggestions.push("Your writing is very complex. Consider major simplification for a general audience.");
  } else if (score < 50) {
    suggestions.push("Your writing is difficult. Try using shorter sentences and simpler vocabulary.");
  } else if (score < 60) {
    suggestions.push("Your writing is fairly difficult. Break up long sentences and replace technical jargon where possible.");
  } else if (score < 70) {
    suggestions.push("Your writing is at a standard level. Consider simplifying some sentences to improve accessibility.");
  }

  if (avgWordsPerSentence > 25) {
    suggestions.push(
      `Your average sentence length is ${Math.round(avgWordsPerSentence)} words. Aim for under 20 words per sentence.`
    );
  }

  if (words < 300) {
    suggestions.push("Content is short. Adding more depth may improve both readability context and SEO.");
  }

  return suggestions;
}

export function computeReadabilityScore(markdown: string): ReadabilityResult {
  const text = stripMarkdown(markdown);

  if (!text || text.trim().length === 0) {
    return {
      score: 0,
      grade: "Very Confusing (College Graduate)",
      suggestions: ["No readable text found. Add content to get a readability score."],
    };
  }

  const wordList = text.split(/\s+/).filter((w) => w.length > 0);
  const words = wordList.length;

  if (words === 0) {
    return {
      score: 0,
      grade: "Very Confusing (College Graduate)",
      suggestions: ["No readable text found. Add content to get a readability score."],
    };
  }

  const sentences = countSentences(text);
  const syllables = wordList.reduce((total, word) => total + countSyllables(word), 0);

  // Flesch-Kincaid Reading Ease formula
  const raw = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);

  // Clamp to 0–100
  const score = Math.round(Math.max(0, Math.min(100, raw)));

  return {
    score,
    grade: getGradeLabel(score),
    suggestions: getSuggestions(score, words, sentences),
  };
}
