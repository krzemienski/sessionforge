"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Prism + 10 language grammars are loaded lazily on first highlight so they
 * don't inflate the initial client bundle (review finding H7). Earlier
 * revisions imported Prism statically at module scope, which forced the whole
 * syntax highlighting bundle into any route that transitively depends on
 * transcript rendering, even when no code block is rendered.
 *
 * The dynamic imports are cached in a module-level promise so repeated code
 * blocks on the same page share a single load. Until the grammars resolve the
 * code renders as plain <code>; the highlight applies on the first frame after
 * the import completes.
 */
type PrismModule = typeof import("prismjs");
let prismPromise: Promise<PrismModule> | null = null;
async function loadPrism(): Promise<PrismModule> {
  if (prismPromise) return prismPromise;
  prismPromise = (async () => {
    const prism = await import("prismjs");
    await Promise.all([
      // @ts-expect-error prism language components ship without .d.ts
      import("prismjs/components/prism-typescript"),
      // @ts-expect-error prism language components ship without .d.ts
      import("prismjs/components/prism-jsx"),
      // @ts-expect-error prism language components ship without .d.ts
      import("prismjs/components/prism-tsx"),
      // @ts-expect-error prism language components ship without .d.ts
      import("prismjs/components/prism-bash"),
      // @ts-expect-error prism language components ship without .d.ts
      import("prismjs/components/prism-json"),
      // @ts-expect-error prism language components ship without .d.ts
      import("prismjs/components/prism-python"),
      // @ts-expect-error prism language components ship without .d.ts
      import("prismjs/components/prism-css"),
      // @ts-expect-error prism language components ship without .d.ts
      import("prismjs/components/prism-sql"),
      // @ts-expect-error prism language components ship without .d.ts
      import("prismjs/components/prism-yaml"),
      // @ts-expect-error prism language components ship without .d.ts
      import("prismjs/components/prism-markdown"),
    ]);
    return prism;
  })();
  return prismPromise;
}

interface CodeBlockProps {
  code: string;
  language?: string;
  className?: string;
}

const LANG_ALIASES: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  py: "python",
  yml: "yaml",
  md: "markdown",
  plaintext: "plain",
  text: "plain",
};

export function CodeBlock({ code, language = "text", className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLElement>(null);
  const [resolvedLang, setResolvedLang] = useState<string>("plain");

  useEffect(() => {
    let cancelled = false;
    loadPrism().then((Prism) => {
      if (cancelled) return;
      const lower = language.toLowerCase();
      const mapped = LANG_ALIASES[lower] ?? lower;
      const finalLang = mapped in Prism.languages ? mapped : "plain";
      setResolvedLang(finalLang);
      if (codeRef.current) {
        Prism.highlightElement(codeRef.current);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [code, language]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available
    }
  };

  return (
    <div
      className={cn(
        "relative group bg-[#1e1e1e] border border-sf-border rounded-sf-lg overflow-hidden",
        className
      )}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-sf-border bg-sf-bg-secondary">
        <span className="text-xs font-code text-sf-accent uppercase tracking-wider">
          {language}
        </span>
        <button
          onClick={handleCopy}
          className={cn(
            "flex items-center gap-1.5 text-xs px-2 py-1 rounded-sf transition-colors",
            copied
              ? "text-sf-success bg-sf-accent-bg"
              : "text-sf-text-muted hover:text-sf-text-primary hover:bg-sf-bg-hover"
          )}
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <Check size={12} />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code */}
      <div className="overflow-x-auto p-4">
        <pre className="m-0 text-[0.8125rem] leading-relaxed font-code" style={{ background: "transparent" }}>
          <code
            ref={codeRef}
            className={`language-${resolvedLang}`}
            style={{
              fontFamily: "'Fira Code', 'JetBrains Mono', monospace",
              background: "transparent",
              fontSize: "inherit",
              lineHeight: "inherit",
            }}
          >
            {code}
          </code>
        </pre>
      </div>
    </div>
  );
}
