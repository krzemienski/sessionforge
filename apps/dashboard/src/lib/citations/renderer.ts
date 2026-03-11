/**
 * Citation Renderer — converts citations to markdown/HTML.
 *
 * Combines citation extraction and formatting to render markdown content
 * with properly formatted citations. Supports multiple output formats:
 * - Footnotes: Academic-style numbered references with a references section
 * - Inline: Clickable inline citation links
 * - Cards: Expandable evidence cards with full context
 *
 * The renderer extracts citation markers from markdown, matches them to
 * metadata, and replaces them with formatted output.
 */

import { CitationExtractor, type Citation } from "./extractor";
import {
  CitationFormatter,
  type CitationMetadata,
  type CitationFormat,
  type FormatOptions,
} from "./formatter";

// ── Types ──────────────────────────────────────────────────────────────────

/** Options for rendering citations. */
export interface RenderOptions extends FormatOptions {
  /** The output format for citations (default: "footnote"). */
  format?: CitationFormat;
}

/** Result of rendering citations in markdown content. */
export interface RenderResult {
  /** The rendered content with formatted citations. */
  content: string;
  /** References section (populated for footnote format, empty otherwise). */
  references: string;
  /** Array of formatted citations with metadata and URLs. */
  citations: Array<{
    sessionId: string;
    messageIndex: number;
    text: string;
    type: CitationMetadata["type"];
    transcriptUrl: string;
    referenceNumber?: number;
  }>;
}

/** Lookup function for retrieving citation metadata. */
export type MetadataLookup = (
  sessionId: string,
  messageIndex: number
) => CitationMetadata | null;

// Re-export CitationMetadata for convenience
export type { CitationMetadata };

// ── CitationRenderer ───────────────────────────────────────────────────────

export class CitationRenderer {
  private extractor: CitationExtractor;
  private formatter: CitationFormatter;

  constructor() {
    this.extractor = new CitationExtractor();
    this.formatter = new CitationFormatter();
  }

  /**
   * Render markdown content with formatted citations.
   *
   * Extracts citation markers from markdown, matches them to the provided
   * metadata, and replaces them with formatted citations in the specified
   * output format.
   *
   * @param markdown - Markdown content containing citation markers
   * @param metadata - Map of citation keys (sessionId:messageIndex) to metadata
   * @param options - Rendering options (format, baseUrl, etc.)
   * @returns Rendered result with content, references, and citation metadata
   *
   * @example
   * ```ts
   * const renderer = new CitationRenderer();
   * const markdown = "We added auth[@session1:5] yesterday.";
   * const metadata = {
   *   "session1:5": {
   *     sessionId: "session1",
   *     messageIndex: 5,
   *     text: "Added JWT authentication",
   *     type: "file_edit"
   *   }
   * };
   * const result = renderer.render(markdown, metadata, { format: "footnote" });
   * // => {
   * //   content: "We added auth[1] yesterday.",
   * //   references: "## References\n\n1. [File Edit] Added JWT...",
   * //   citations: [...]
   * // }
   * ```
   */
  render(
    markdown: string,
    metadata: Record<string, CitationMetadata>,
    options: RenderOptions = {}
  ): RenderResult {
    const format = options.format ?? "footnote";

    // Extract all citations from markdown (excludes code blocks)
    const extractedCitations = this.extractor.extract(markdown);

    if (extractedCitations.length === 0) {
      return {
        content: markdown,
        references: "",
        citations: [],
      };
    }

    // Build map of unique citations with metadata
    const uniqueCitations = new Map<string, CitationMetadata>();
    const citationsList: CitationMetadata[] = [];

    for (const citation of extractedCitations) {
      const key = `${citation.sessionId}:${citation.messageIndex}`;
      const meta = metadata[key];

      if (meta && !uniqueCitations.has(key)) {
        uniqueCitations.set(key, meta);
        citationsList.push(meta);
      }
    }

    // If no valid metadata found, return original markdown
    if (uniqueCitations.size === 0) {
      return {
        content: markdown,
        references: "",
        citations: [],
      };
    }

    // Build reference number mapping
    const refNumbers = new Map<string, number>();
    Array.from(uniqueCitations.keys()).forEach((key, index) => {
      refNumbers.set(key, index + 1);
    });

    // Replace citations in reverse order to maintain positions
    let content = markdown;
    const sortedCitations = [...extractedCitations].sort(
      (a, b) => b.position - a.position
    );

    for (const citation of sortedCitations) {
      const key = `${citation.sessionId}:${citation.messageIndex}`;
      const meta = uniqueCitations.get(key);

      if (!meta) continue;

      const refNum = refNumbers.get(key)!;
      const formatted = this.formatter.formatCitation(
        meta,
        format,
        refNum,
        options
      );

      // Replace only this specific occurrence at this position
      const before = content.slice(0, citation.position);
      const after = content.slice(citation.position + citation.marker.length);
      content = before + formatted.content + after;
    }

    // Build references section
    const references =
      format === "footnote"
        ? this.buildReferencesSection(citationsList, options)
        : "";

    // Build result with enriched citation data
    const citations = citationsList.map((meta, index) => {
      const refNum = index + 1;
      const transcriptUrl = this.buildTranscriptUrl(meta, options.baseUrl);

      return {
        sessionId: meta.sessionId,
        messageIndex: meta.messageIndex,
        text: meta.text,
        type: meta.type,
        transcriptUrl,
        referenceNumber: format === "footnote" ? refNum : undefined,
      };
    });

    return {
      content,
      references,
      citations,
    };
  }

  /**
   * Render markdown with dynamic metadata lookup.
   *
   * Similar to render(), but uses a lookup function to retrieve citation
   * metadata on demand rather than requiring a pre-built map. Useful when
   * metadata needs to be fetched from a database or external source.
   *
   * @param markdown - Markdown content containing citation markers
   * @param lookupFn - Function to retrieve citation metadata by sessionId and messageIndex
   * @param options - Rendering options
   * @returns Rendered result with content, references, and citation metadata
   *
   * @example
   * ```ts
   * const renderer = new CitationRenderer();
   * const markdown = "Citation[@session1:5] here.";
   * const lookupFn = async (sessionId, messageIndex) => {
   *   return await db.getCitationMetadata(sessionId, messageIndex);
   * };
   * const result = renderer.renderWithMetadataLookup(markdown, lookupFn);
   * ```
   */
  renderWithMetadataLookup(
    markdown: string,
    lookupFn: MetadataLookup,
    options: RenderOptions = {}
  ): RenderResult {
    // Extract citations
    const extractedCitations = this.extractor.extract(markdown);

    if (extractedCitations.length === 0) {
      return {
        content: markdown,
        references: "",
        citations: [],
      };
    }

    // Build metadata map using lookup function
    const metadata: Record<string, CitationMetadata> = {};
    for (const citation of extractedCitations) {
      const key = `${citation.sessionId}:${citation.messageIndex}`;
      const meta = lookupFn(citation.sessionId, citation.messageIndex);

      if (meta) {
        metadata[key] = meta;
      }
    }

    // Delegate to standard render method
    return this.render(markdown, metadata, options);
  }

  /**
   * Get the complete output combining content and references.
   *
   * Convenience method that concatenates the content and references sections
   * from a render result into a single markdown string.
   *
   * @param result - Render result from render() or renderWithMetadataLookup()
   * @returns Complete markdown output with content and references
   *
   * @example
   * ```ts
   * const renderer = new CitationRenderer();
   * const result = renderer.render(markdown, metadata, { format: "footnote" });
   * const fullOutput = renderer.getFullOutput(result);
   * // => "Content with citations[1].\n\n## References\n\n1. ..."
   * ```
   */
  getFullOutput(result: RenderResult): string {
    if (result.references) {
      return `${result.content}\n\n${result.references}`;
    }
    return result.content;
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  /**
   * Build a transcript URL for a citation.
   */
  private buildTranscriptUrl(
    citation: CitationMetadata,
    baseUrl: string = "/sessions"
  ): string {
    const cleanBaseUrl = baseUrl.endsWith("/")
      ? baseUrl.slice(0, -1)
      : baseUrl;
    return `${cleanBaseUrl}/${citation.sessionId}#msg-${citation.messageIndex}`;
  }

  /**
   * Build a markdown references section for footnote format.
   */
  private buildReferencesSection(
    citations: CitationMetadata[],
    options: RenderOptions
  ): string {
    if (citations.length === 0) {
      return "";
    }

    const TYPE_LABELS: Record<CitationMetadata["type"], string> = {
      tool_call: "Tool Call",
      file_edit: "File Edit",
      conversation: "Conversation",
      evidence: "Evidence",
    };

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
