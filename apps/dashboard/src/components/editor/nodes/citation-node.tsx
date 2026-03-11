/**
 * Lexical DecoratorNode for inline citation markers.
 *
 * Renders citation markers in the format [@sessionId:messageIndex] as
 * interactive inline elements in the Lexical editor. Citations can be
 * clicked to view the source session transcript.
 */

import type { ReactElement } from "react";
import {
  DecoratorNode,
  type DOMConversionMap,
  type DOMExportOutput,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from "lexical";
import { CitationInlineMarker } from "../../citations/citation-inline-marker";

// ── Types ──────────────────────────────────────────────────────────────────

export type SerializedCitationNode = Spread<
  {
    sessionId: string;
    messageIndex: number;
  },
  SerializedLexicalNode
>;

// ── CitationNode ───────────────────────────────────────────────────────────

/**
 * A Lexical DecoratorNode that renders inline citation markers.
 *
 * Citations reference specific messages in a coding session transcript.
 * They render as clickable inline elements with hover previews.
 *
 * @example
 * ```tsx
 * const node = $createCitationNode("abc-123", 10);
 * // Renders: [@abc-123:10]
 * ```
 */
export class CitationNode extends DecoratorNode<ReactElement> {
  __sessionId: string;
  __messageIndex: number;

  static getType(): string {
    return "citation";
  }

  static clone(node: CitationNode): CitationNode {
    return new CitationNode(node.__sessionId, node.__messageIndex, node.__key);
  }

  constructor(sessionId: string, messageIndex: number, key?: NodeKey) {
    super(key);
    this.__sessionId = sessionId;
    this.__messageIndex = messageIndex;
  }

  // ── Serialization ────────────────────────────────────────────────────────

  static importJSON(serializedNode: SerializedCitationNode): CitationNode {
    return $createCitationNode(
      serializedNode.sessionId,
      serializedNode.messageIndex
    );
  }

  exportJSON(): SerializedCitationNode {
    return {
      type: "citation",
      version: 1,
      sessionId: this.__sessionId,
      messageIndex: this.__messageIndex,
    };
  }

  // ── DOM Conversion ───────────────────────────────────────────────────────

  createDOM(_config: EditorConfig): HTMLElement {
    const span = document.createElement("span");
    span.className = "citation-node";
    span.setAttribute("data-lexical-citation", "true");
    span.setAttribute("data-session-id", this.__sessionId);
    span.setAttribute("data-message-index", String(this.__messageIndex));
    return span;
  }

  updateDOM(): boolean {
    // Citation nodes are immutable - return false to prevent updates
    return false;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("span");
    element.className = "citation-marker";
    element.textContent = `[@${this.__sessionId}:${this.__messageIndex}]`;
    return { element };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      span: (domNode: HTMLElement) => {
        if (!domNode.hasAttribute("data-lexical-citation")) {
          return null;
        }
        return {
          conversion: (element: HTMLElement) => {
            const sessionId = element.getAttribute("data-session-id");
            const messageIndex = element.getAttribute("data-message-index");
            if (!sessionId || !messageIndex) {
              return null;
            }
            return {
              node: $createCitationNode(sessionId, parseInt(messageIndex, 10)),
            };
          },
          priority: 1,
        };
      },
    };
  }

  // ── React Component ──────────────────────────────────────────────────────

  decorate(): ReactElement {
    return (
      <CitationInlineMarker
        sessionId={this.__sessionId}
        messageIndex={this.__messageIndex}
        nodeKey={this.__key}
      />
    );
  }

  // ── Utilities ────────────────────────────────────────────────────────────

  getSessionId(): string {
    return this.__sessionId;
  }

  getMessageIndex(): number {
    return this.__messageIndex;
  }

  getTextContent(): string {
    return `[@${this.__sessionId}:${this.__messageIndex}]`;
  }

  isInline(): boolean {
    return true;
  }
}

// ── Factory Function ───────────────────────────────────────────────────────

/**
 * Create a new CitationNode.
 *
 * @param sessionId - Session UUID or identifier
 * @param messageIndex - Zero-based message index within the session
 * @returns A new CitationNode instance
 *
 * @example
 * ```tsx
 * import { $createCitationNode } from './nodes/citation-node';
 *
 * editor.update(() => {
 *   const citation = $createCitationNode("abc-123", 10);
 *   $insertNodes([citation]);
 * });
 * ```
 */
export function $createCitationNode(
  sessionId: string,
  messageIndex: number
): CitationNode {
  return new CitationNode(sessionId, messageIndex);
}

/**
 * Type guard to check if a node is a CitationNode.
 *
 * @param node - The Lexical node to check
 * @returns True if the node is a CitationNode
 *
 * @example
 * ```tsx
 * if ($isCitationNode(node)) {
 *   const sessionId = node.getSessionId();
 * }
 * ```
 */
export function $isCitationNode(
  node: LexicalNode | null | undefined
): node is CitationNode {
  return node instanceof CitationNode;
}
