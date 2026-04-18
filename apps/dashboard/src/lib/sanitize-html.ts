/**
 * Defense-in-depth HTML sanitizer for content that eventually flows into
 * `dangerouslySetInnerHTML`. Review finding M1.
 *
 * Used by:
 *   - Mermaid SVG output (user-authored diagrams)
 *   - highlight.js syntax-highlighted HTML (user-authored code fences)
 *
 * highlight.js and mermaid both escape user input in practice, but have had
 * historical CVEs. Sanitizing a second time at the render boundary is cheap
 * and survives a bypass in the upstream renderer.
 *
 * Two profiles:
 *   - `sanitizeInlineHtml`  — hljs token spans; strips ALL tags except <span>
 *     with class attrs. Output is safe to drop into a <span>.
 *   - `sanitizeSvg`         — DOMPurify svg profile + explicit blocks for
 *     <script>, <foreignObject>, and common event handler attrs.
 *
 * Both are client-only (DOMPurify needs window). Call from useEffect or after
 * a dynamic import gate.
 */
import DOMPurify from "dompurify";

export function sanitizeInlineHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["span", "b", "i", "em", "strong", "code", "br"],
    ALLOWED_ATTR: ["class"],
  });
}

export function sanitizeSvg(svg: string): string {
  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ["script", "foreignObject"],
    FORBID_ATTR: ["onload", "onerror", "onclick", "onmouseover", "onfocus"],
  });
}
