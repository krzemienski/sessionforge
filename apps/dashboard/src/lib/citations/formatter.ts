/**
 * Citation Formatter — formats citations for different output types.
 *
 * Converts citation data into various display formats:
 * - Footnotes: Classic academic-style numbered footnotes with references section
 * - Inline: Inline citation markers with clickable links
 * - Cards: Rich expandable evidence cards with full context
 *
 * Each format generates session transcript links for verification.
 */

// ── Types ──────────────────────────────────────────────────────────────────

/** Citation metadata stored in the database. */
export interface CitationMetadata {
  sessionId: string;
  messageIndex: number;
  text: string;
  type: "tool_call" | "file_edit" | "conversation" | "evidence";
}

/** Citation with marker position from extraction. */
export interface CitationWithMarker extends CitationMetadata {
  marker: string;
  position: number;
}

/** Supported citation output formats. */
export type CitationFormat = "footnote" | "inline" | "card";

/** Options for citation formatting. */
export interface FormatOptions {
  /** Base URL for session transcript viewer (e.g., "/workspace/sessions"). */
  baseUrl?: string;
  /** Whether to include the session type label (default: true). */
  includeTypeLabel?: boolean;
  /** Maximum characters for text preview in cards (default: 100). */
  maxPreviewChars?: number;
}

/** Formatted citation output. */
export interface FormattedCitation {
  /** The formatted citation string (markdown or HTML). */
  content: string;
  /** Reference number for footnote format (1-indexed). */
  referenceNumber?: number;
  /** URL to the session transcript location. */
  transcriptUrl: string;
}

/** Complete formatted output with content and references section. */
export interface FormattedOutput {
  /** Main content with formatted citations. */
  content: string;
  /** References section (for footnote format, empty string otherwise). */
  references: string;
  /** Array of formatted citations with URLs. */
  citations: FormattedCitation[];
}

// ── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_BASE_URL = "/sessions";
const DEFAULT_MAX_PREVIEW_CHARS = 100;

/** Human-readable labels for citation types. */
const TYPE_LABELS: Record<CitationMetadata["type"], string> = {
  tool_call: "Tool Call",
  file_edit: "File Edit",
  conversation: "Conversation",
  evidence: "Evidence",
};

// ── CitationFormatter ──────────────────────────────────────────────────────

export class CitationFormatter {
  /**
   * Format a single citation for a specific output format.
   *
   * @param citation - The citation metadata to format
   * @param format - The desired output format
   * @param referenceNumber - Reference number for footnote format (1-indexed)
   * @param options - Formatting options
   * @returns Formatted citation with transcript URL
   *
   * @example
   * ```ts
   * const formatter = new CitationFormatter();
   * const citation = {
   *   sessionId: "abc123",
   *   messageIndex: 10,
   *   text: "Refactored auth module",
   *   type: "file_edit" as const
   * };
   * const formatted = formatter.formatCitation(citation, "footnote", 1);
   * // => { content: "[1]", transcriptUrl: "/sessions/abc123#msg-10", referenceNumber: 1 }
   * ```
   */
  formatCitation(
    citation: CitationMetadata,
    format: CitationFormat,
    referenceNumber?: number,
    options: FormatOptions = {}
  ): FormattedCitation {
    const transcriptUrl = this.buildTranscriptUrl(citation, options.baseUrl);

    switch (format) {
      case "footnote":
        if (referenceNumber === undefined) {
          throw new Error("Reference number required for footnote format");
        }
        return {
          content: `[${referenceNumber}]`,
          referenceNumber,
          transcriptUrl,
        };

      case "inline":
        return {
          content: this.formatInlineCitation(citation, transcriptUrl, options),
          transcriptUrl,
        };

      case "card":
        return {
          content: this.formatCardCitation(citation, transcriptUrl, options),
          transcriptUrl,
        };

      default:
        throw new Error(`Unsupported citation format: ${format}`);
    }
  }

  /**
   * Format multiple citations into a complete output with references section.
   *
   * Takes an array of citations and formats them according to the specified
   * format. For footnote format, generates a references section. For inline
   * and card formats, embeds citations directly in content.
   *
   * @param citations - Array of citations to format
   * @param format - The desired output format
   * @param options - Formatting options
   * @returns Complete formatted output with content and references
   *
   * @example
   * ```ts
   * const formatter = new CitationFormatter();
   * const citations = [
   *   { sessionId: "s1", messageIndex: 1, text: "Added auth", type: "file_edit" as const },
   *   { sessionId: "s2", messageIndex: 5, text: "Fixed bug", type: "tool_call" as const }
   * ];
   * const output = formatter.formatMultiple(citations, "footnote");
   * // => {
   * //   content: "",
   * //   references: "## References\n\n1. [File Edit] Added auth - [View in session](/sessions/s1#msg-1)\n...",
   * //   citations: [...]
   * // }
   * ```
   */
  formatMultiple(
    citations: CitationMetadata[],
    format: CitationFormat,
    options: FormatOptions = {}
  ): FormattedOutput {
    if (citations.length === 0) {
      return {
        content: "",
        references: "",
        citations: [],
      };
    }

    const formattedCitations = citations.map((citation, index) =>
      this.formatCitation(citation, format, index + 1, options)
    );

    let references = "";
    if (format === "footnote") {
      references = this.buildReferencesSection(citations, options);
    }

    return {
      content: "", // Content is managed separately by the renderer
      references,
      citations: formattedCitations,
    };
  }

  /**
   * Replace citation markers in markdown with formatted citations.
   *
   * Scans markdown content for citation markers ([@sessionId:messageIndex])
   * and replaces them with formatted citations in the specified format.
   *
   * @param markdown - Markdown content with citation markers
   * @param citationsMap - Map of citation markers to metadata
   * @param format - The desired output format
   * @param options - Formatting options
   * @returns Formatted output with replaced citations
   *
   * @example
   * ```ts
   * const formatter = new CitationFormatter();
   * const markdown = "We refactored[@s1:1] the module.";
   * const citationsMap = {
   *   "[@s1:1]": { sessionId: "s1", messageIndex: 1, text: "Refactored", type: "file_edit" as const }
   * };
   * const output = formatter.replaceCitations(markdown, citationsMap, "footnote");
   * // => { content: "We refactored[1] the module.", references: "## References\n\n1. ...", citations: [...] }
   * ```
   */
  replaceCitations(
    markdown: string,
    citationsMap: Record<string, CitationMetadata>,
    format: CitationFormat,
    options: FormatOptions = {}
  ): FormattedOutput {
    const citations: CitationMetadata[] = [];
    const markerToNumber = new Map<string, number>();

    // Build mapping of markers to reference numbers
    let referenceNumber = 1;
    for (const marker in citationsMap) {
      markerToNumber.set(marker, referenceNumber);
      citations.push(citationsMap[marker]);
      referenceNumber++;
    }

    // Replace markers with formatted citations
    let content = markdown;
    for (const [marker, citation] of Object.entries(citationsMap)) {
      const refNum = markerToNumber.get(marker);
      if (refNum === undefined) continue;

      const formatted = this.formatCitation(citation, format, refNum, options);
      // Use replaceAll to handle multiple occurrences of the same marker
      content = content.replaceAll(marker, formatted.content);
    }

    const references =
      format === "footnote"
        ? this.buildReferencesSection(citations, options)
        : "";

    return {
      content,
      references,
      citations: citations.map((citation, index) =>
        this.formatCitation(citation, format, index + 1, options)
      ),
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  /**
   * Build a transcript URL for a citation.
   *
   * Generates a URL pointing to the specific message in the session transcript.
   * Format: {baseUrl}/{sessionId}#msg-{messageIndex}
   */
  private buildTranscriptUrl(
    citation: CitationMetadata,
    baseUrl: string = DEFAULT_BASE_URL
  ): string {
    const cleanBaseUrl = baseUrl.endsWith("/")
      ? baseUrl.slice(0, -1)
      : baseUrl;
    return `${cleanBaseUrl}/${citation.sessionId}#msg-${citation.messageIndex}`;
  }

  /**
   * Format a citation for inline display.
   *
   * Creates a clickable inline link with optional type label.
   * Format: [View source] or [File Edit]
   */
  private formatInlineCitation(
    citation: CitationMetadata,
    transcriptUrl: string,
    options: FormatOptions
  ): string {
    const includeTypeLabel = options.includeTypeLabel ?? true;
    const label = includeTypeLabel
      ? TYPE_LABELS[citation.type]
      : "View source";
    return `[[${label}]](${transcriptUrl})`;
  }

  /**
   * Format a citation as an expandable card.
   *
   * Creates a markdown details/summary block with citation context.
   * Includes citation type, text preview, and link to transcript.
   */
  private formatCardCitation(
    citation: CitationMetadata,
    transcriptUrl: string,
    options: FormatOptions
  ): string {
    const maxChars = options.maxPreviewChars ?? DEFAULT_MAX_PREVIEW_CHARS;
    const typeLabel = TYPE_LABELS[citation.type];
    const preview =
      citation.text.length > maxChars
        ? `${citation.text.slice(0, maxChars)}...`
        : citation.text;

    return `<details>
<summary><strong>${typeLabel}</strong> - ${preview}</summary>

**Session:** ${citation.sessionId}
**Message:** #${citation.messageIndex}
**Type:** ${typeLabel}

> ${citation.text}

[View in session transcript](${transcriptUrl})
</details>`;
  }

  /**
   * Build a markdown references section for footnote format.
   *
   * Generates a numbered list of citations with links to session transcripts.
   * Format:
   * ## References
   *
   * 1. [Type] Text - [View in session](url)
   * 2. [Type] Text - [View in session](url)
   */
  private buildReferencesSection(
    citations: CitationMetadata[],
    options: FormatOptions
  ): string {
    if (citations.length === 0) {
      return "";
    }

    const lines = ["## References", ""];

    citations.forEach((citation, index) => {
      const refNum = index + 1;
      const typeLabel = TYPE_LABELS[citation.type];
      const transcriptUrl = this.buildTranscriptUrl(
        citation,
        options.baseUrl
      );

      lines.push(
        `${refNum}. [${typeLabel}] ${citation.text} - [View in session](${transcriptUrl})`
      );
    });

    return lines.join("\n");
  }
}
