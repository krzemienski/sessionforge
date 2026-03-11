"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { $getRoot, EditorState } from "lexical";
import { detectAiPatterns } from "@/lib/writing-coach";

/**
 * Lexical plugin that detects AI writing patterns in the editor content.
 *
 * This plugin:
 * - Listens to editor content changes (debounced 1500ms)
 * - Extracts plain text from the editor state
 * - Runs AI pattern detection on the text
 * - Displays a floating badge with the count of detected patterns
 *
 * The plugin is completely non-blocking and read-only:
 * - Never modifies the editor state
 * - Only reads text content for analysis
 */
export function AiPatternHighlightPlugin() {
  const [editor] = useLexicalComposerContext();
  const [patternCount, setPatternCount] = useState<number>(0);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  /**
   * Handles editor content changes with debouncing.
   * Extracts plain text and runs AI pattern detection.
   */
  const handleEditorChange = useCallback(
    (editorState: EditorState) => {
      // Clear any existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set up new debounced analysis
      debounceTimerRef.current = setTimeout(() => {
        editorState.read(() => {
          // Extract plain text from editor state (read-only, non-blocking)
          const root = $getRoot();
          const plainText = root.getTextContent();

          // Run AI pattern detection
          const patterns = detectAiPatterns(plainText);
          setPatternCount(patterns.length);
        });
      }, 1500); // Debounce delay: 1500ms
    },
    []
  );

  return (
    <>
      <OnChangePlugin onChange={handleEditorChange} ignoreSelectionChange />
      {patternCount > 0 && (
        <div className="mt-3 px-4 py-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-sf-md text-sm text-amber-800 dark:text-amber-200">
          <button
            type="button"
            className="hover:underline focus:outline-none focus:underline"
            onClick={() => {
              // Placeholder for future review functionality
              // Could open a modal or panel showing all detected patterns
            }}
          >
            {patternCount} AI pattern{patternCount !== 1 ? "s" : ""} detected -{" "}
            click to review
          </button>
        </div>
      )}
    </>
  );
}
