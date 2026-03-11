/**
 * CitationExtractor — parser for extracting citation markers from markdown.
 *
 * Parses citation markers in the format [@sessionId:messageIndex] from markdown
 * content, providing utilities to extract, remove, and count citations while
 * respecting code blocks and inline code boundaries.
 *
 * Citation format: [@sessionId:messageIndex]
 *   - sessionId: UUID or string identifier for the Claude session
 *   - messageIndex: zero-based message index within the session
 *
 * Example: "We refactored the auth module[@550e8400-e29b-41d4:10] yesterday."
 */

// ── Types ──────────────────────────────────────────────────────────────────

/** A parsed citation marker from markdown content. */
export interface Citation {
  /** Session UUID or identifier. */
  sessionId: string;
  /** Zero-based message index within the session. */
  messageIndex: number;
  /** The full citation marker as it appears in the text (e.g., "[@session1:5]"). */
  marker: string;
  /** Character position where the marker starts in the original markdown. */
  position: number;
}

/** A citation with surrounding text context. */
export interface CitationWithContext extends Citation {
  /** Text immediately before the citation marker (up to maxChars). */
  textBefore: string;
  /** Text immediately after the citation marker (up to maxChars). */
  textAfter: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

/** Regex pattern for matching citation markers: [@sessionId:messageIndex] */
const CITATION_PATTERN = /\[@([a-zA-Z0-9-]+):(\d+)\]/g;

/**
 * Regex pattern for detecting code blocks and inline code.
 * Matches:
 *   - Fenced code blocks: ```...```
 *   - Inline code: `...`
 */
const CODE_PATTERN = /(```[\s\S]*?```|`[^`]+?`)/g;

// ── CitationExtractor ──────────────────────────────────────────────────────

export class CitationExtractor {
  /**
   * Extract all citation markers from markdown content.
   *
   * Finds all citations in the format [@sessionId:messageIndex], excluding
   * those within code blocks or inline code spans.
   *
   * @param markdown - The markdown content to parse
   * @returns Array of parsed citations in order of appearance
   *
   * @example
   * ```ts
   * const extractor = new CitationExtractor();
   * const markdown = "We refactored[@session1:10] the auth module.";
   * const citations = extractor.extract(markdown);
   * // => [{ sessionId: "session1", messageIndex: 10, marker: "[@session1:10]", position: 14 }]
   * ```
   */
  extract(markdown: string): Citation[] {
    // Get positions of all code regions to exclude
    const codeRegions = this.findCodeRegions(markdown);

    const citations: Citation[] = [];
    const pattern = new RegExp(CITATION_PATTERN);
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(markdown)) !== null) {
      const position = match.index;

      // Skip if citation is within a code region
      if (this.isInCodeRegion(position, codeRegions)) {
        continue;
      }

      const sessionId = match[1];
      const messageIndex = parseInt(match[2], 10);
      const marker = match[0];

      citations.push({
        sessionId,
        messageIndex,
        marker,
        position,
      });
    }

    return citations;
  }

  /**
   * Extract citations with surrounding text context.
   *
   * Similar to extract(), but includes the text immediately before and after
   * each citation marker for display or preview purposes.
   *
   * @param markdown - The markdown content to parse
   * @param contextChars - Maximum characters to include before/after each citation (default: 50)
   * @returns Array of citations with text context
   *
   * @example
   * ```ts
   * const extractor = new CitationExtractor();
   * const markdown = "We implemented JWT auth[@session1:5] last week.";
   * const citations = extractor.extractWithContext(markdown, 20);
   * // => [{
   * //   sessionId: "session1",
   * //   messageIndex: 5,
   * //   marker: "[@session1:5]",
   * //   position: 23,
   * //   textBefore: "plemented JWT auth",
   * //   textAfter: " last week."
   * // }]
   * ```
   */
  extractWithContext(
    markdown: string,
    contextChars = 50
  ): CitationWithContext[] {
    const citations = this.extract(markdown);

    return citations.map((citation) => {
      const beforeStart = Math.max(0, citation.position - contextChars);
      const afterEnd = Math.min(
        markdown.length,
        citation.position + citation.marker.length + contextChars
      );

      const textBefore = markdown.slice(beforeStart, citation.position);
      const textAfter = markdown.slice(
        citation.position + citation.marker.length,
        afterEnd
      );

      return {
        ...citation,
        textBefore,
        textAfter,
      };
    });
  }

  /**
   * Remove all citation markers from markdown content.
   *
   * Strips citation markers while preserving all other markdown formatting.
   * Useful for generating clean output without citation annotations.
   *
   * @param markdown - The markdown content containing citations
   * @returns Markdown with all citation markers removed
   *
   * @example
   * ```ts
   * const extractor = new CitationExtractor();
   * const markdown = "We refactored[@s1:1] the module[@s2:2].";
   * const cleaned = extractor.removeCitations(markdown);
   * // => "We refactored the module."
   * ```
   */
  removeCitations(markdown: string): string {
    return markdown.replace(CITATION_PATTERN, "");
  }

  /**
   * Count the number of citations in markdown content.
   *
   * @param markdown - The markdown content to analyze
   * @returns Number of valid citation markers found
   *
   * @example
   * ```ts
   * const extractor = new CitationExtractor();
   * const count = extractor.getCitationCount("One[@s1:1] two[@s2:2].");
   * // => 2
   * ```
   */
  getCitationCount(markdown: string): number {
    return this.extract(markdown).length;
  }

  /**
   * Check if markdown content contains any citations.
   *
   * @param markdown - The markdown content to check
   * @returns True if at least one citation marker is present
   *
   * @example
   * ```ts
   * const extractor = new CitationExtractor();
   * extractor.hasCitations("No citations here"); // => false
   * extractor.hasCitations("Has one[@s:1].");     // => true
   * ```
   */
  hasCitations(markdown: string): boolean {
    return this.getCitationCount(markdown) > 0;
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  /**
   * Find all code regions (code blocks and inline code) in markdown.
   *
   * Returns an array of [start, end] positions for each code region.
   * Citations within these regions should be ignored.
   */
  private findCodeRegions(markdown: string): Array<[number, number]> {
    const regions: Array<[number, number]> = [];
    const pattern = new RegExp(CODE_PATTERN);
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(markdown)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      regions.push([start, end]);
    }

    return regions;
  }

  /**
   * Check if a given position falls within any code region.
   */
  private isInCodeRegion(
    position: number,
    codeRegions: Array<[number, number]>
  ): boolean {
    return codeRegions.some(
      ([start, end]) => position >= start && position < end
    );
  }
}
