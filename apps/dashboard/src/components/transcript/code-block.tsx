"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

// Prism is loaded as a client-side effect to avoid SSR issues.
// The import is deferred so that the prism.js globals are set up
// after the window/document are available.
import Prism from "prismjs";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-json";
import "prismjs/components/prism-python";
import "prismjs/components/prism-css";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-markdown";

interface CodeBlockProps {
  code: string;
  language?: string;
  className?: string;
}

// Map common aliases to Prism language names
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

function resolveLanguage(lang: string): string {
  const lower = lang.toLowerCase();
  const mapped = LANG_ALIASES[lower] ?? lower;
  // Only return a grammar that Prism actually knows about
  return mapped in Prism.languages ? mapped : "plain";
}

export function CodeBlock({ code, language = "text", className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLElement>(null);
  const resolvedLang = resolveLanguage(language);

  // Highlight after render / when code changes
  useEffect(() => {
    if (codeRef.current) {
      Prism.highlightElement(codeRef.current);
    }
  }, [code, resolvedLang]);

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
