export type FenceEntry = { language: string; isDelimiter: boolean };

/**
 * Detect markdown code fences and return a map from lineIndex -> fence info.
 * Works on any flat array of strings (not tied to diff segments).
 */
export function detectCodeFences(lines: string[]): Map<number, FenceEntry> {
  const map = new Map<number, FenceEntry>();
  let inFence = false;
  let language = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const openMatch = line.match(/^```(\w*)\s*$/);

    if (!inFence && openMatch) {
      inFence = true;
      language = openMatch[1] ?? "";
      map.set(i, { language, isDelimiter: true });
    } else if (inFence && /^```\s*$/.test(line)) {
      map.set(i, { language, isDelimiter: true });
      inFence = false;
      language = "";
    } else if (inFence) {
      map.set(i, { language, isDelimiter: false });
    }
  }

  return map;
}

/**
 * Apply syntax highlighting to code fence blocks in a flat lines array.
 * Returns a map of lineIndex -> highlighted HTML string for lines inside fences.
 * Lines outside fences are not included in the map (fall back to plain text).
 */
export async function buildHighlightMapFromLines(
  lines: string[]
): Promise<Map<number, string>> {
  const hlMap = new Map<number, string>();

  try {
    // highlight.js may resolve as the HLJSApi directly (ambient module)
    // or as a module with a .default export — handle both
    const hljsRaw: any = await import("highlight.js");
    const hljs: any = hljsRaw.default ?? hljsRaw;

    const fenceMap = detectCodeFences(lines);

    let blockLanguage = "";
    let blockLines: string[] = [];
    let blockIndices: number[] = [];

    const flushBlock = () => {
      if (blockLines.length === 0) return;
      const code = blockLines.join("\n");
      let highlighted: string;
      try {
        if (blockLanguage && hljs.getLanguage(blockLanguage)) {
          highlighted = hljs.highlight(code, { language: blockLanguage }).value;
        } else {
          highlighted = hljs.highlightAuto(code).value;
        }
      } catch {
        highlighted = code;
      }
      const highlightedLines = highlighted.split("\n");
      blockIndices.forEach((idx, i) => {
        hlMap.set(idx, highlightedLines[i] ?? "");
      });
      blockLines = [];
      blockIndices = [];
    };

    for (let i = 0; i < lines.length; i++) {
      const fence = fenceMap.get(i);
      if (!fence) {
        // Not in a fence — flush any pending block
        if (blockLines.length > 0) {
          flushBlock();
        }
        continue;
      }
      if (fence.isDelimiter) {
        // Opener sets language; closer flushes current block
        if (blockLines.length > 0) {
          flushBlock();
        }
        blockLanguage = fence.language;
      } else {
        blockLines.push(lines[i]);
        blockIndices.push(i);
      }
    }
    flushBlock();
  } catch {
    // highlight.js unavailable — return empty map (plain text fallback)
  }

  return hlMap;
}
