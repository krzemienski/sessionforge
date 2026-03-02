"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
  code: string;
  language?: string;
  className?: string;
}

const customStyle = {
  margin: 0,
  padding: "1rem",
  background: "transparent",
  fontSize: "0.8125rem",
  fontFamily: "'Fira Code', monospace",
  lineHeight: 1.6,
};

const codeTagStyle = {
  fontFamily: "'Fira Code', monospace",
};

export function CodeBlock({ code, language = "text", className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

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
    <div className={cn("relative group bg-sf-bg-tertiary border border-sf-border rounded-sf-lg overflow-hidden", className)}>
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
      <div className="overflow-x-auto">
        <SyntaxHighlighter
          language={language === "text" ? "plaintext" : language}
          style={vscDarkPlus}
          customStyle={customStyle}
          codeTagProps={{ style: codeTagStyle }}
          wrapLongLines={false}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
