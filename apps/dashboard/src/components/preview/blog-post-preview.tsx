"use client";

import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import type { Components } from "react-markdown";
import { CitationLink, CITATION_REGEX } from "./citation-link";

// Minimal hast node shape needed to inspect pre > code language
type HastNode = {
  type: string;
  tagName?: string;
  properties?: { className?: string[] };
  children?: HastNode[];
};

// --- MermaidDiagram ---

interface MermaidDiagramProps {
  chart: string;
}

function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSvg("");
    setError(null);

    async function render() {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          themeVariables: {
            darkMode: true,
            background: "#111111",
            primaryColor: "#00FF88",
            primaryTextColor: "#EDEDED",
            primaryBorderColor: "#2A2A2A",
            lineColor: "#888888",
            textColor: "#EDEDED",
          },
        });

        // Unique ID per render to avoid mermaid conflicts
        const renderId = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const { svg: rendered } = await mermaid.render(renderId, chart.trim());
        if (!cancelled) setSvg(rendered);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to render diagram");
        }
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [chart]);

  if (error) {
    return (
      <div className="my-4 rounded-sf border border-sf-danger/30 bg-sf-danger/10 p-4">
        <p className="mb-2 font-code text-xs text-sf-danger">Mermaid render error</p>
        <pre className="overflow-x-auto text-xs text-sf-text-secondary">{chart}</pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="my-4 rounded-sf border border-sf-border bg-sf-bg-tertiary p-4">
        <p className="text-xs text-sf-text-muted">Rendering diagram…</p>
      </div>
    );
  }

  return (
    <div
      className="my-4 flex justify-center overflow-x-auto rounded-sf-lg border border-sf-border bg-sf-bg-secondary p-4"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

// --- Citation rendering helper ---

function renderWithCitations(
  children: React.ReactNode,
  onCitationClick?: (type: string, label: string) => void
): React.ReactNode {
  if (typeof children === "string") {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    const regex = new RegExp(CITATION_REGEX.source, "g");
    let match;

    while ((match = regex.exec(children)) !== null) {
      if (match.index > lastIndex) {
        parts.push(children.slice(lastIndex, match.index));
      }
      const type = match[1].toLowerCase() as "session" | "source" | "repo" | "brief";
      const label = match[2]?.trim() || match[1];
      parts.push(
        <CitationLink
          key={`${match.index}-${type}`}
          type={type}
          label={label}
          onClick={() => onCitationClick?.(type, label)}
        />
      );
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < children.length) {
      parts.push(children.slice(lastIndex));
    }

    return parts.length > 0 ? <>{parts}</> : children;
  }

  if (Array.isArray(children)) {
    return children.map((child, i) => (
      <React.Fragment key={i}>{renderWithCitations(child, onCitationClick)}</React.Fragment>
    ));
  }

  return children;
}

// --- Markdown component map ---

function createMarkdownComponents(
  onCitationClick?: (type: string, label: string) => void
): Components {
  return {
  h1: ({ children }) => (
    <h1 className="mb-4 mt-6 font-display text-2xl font-bold text-sf-text-primary first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-3 mt-5 border-b border-sf-border pb-1 font-display text-xl font-semibold text-sf-text-primary">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-4 font-display text-lg font-semibold text-sf-text-primary">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mb-2 mt-3 font-display text-base font-semibold text-sf-text-primary">
      {children}
    </h4>
  ),
  p: ({ children }) => (
    <p className="mb-3 text-sm leading-7 text-sf-text-primary">
      {renderWithCitations(children, onCitationClick)}
    </p>
  ),
  strong: ({ children }) => (
    <strong className="font-bold text-sf-text-primary">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  del: ({ children }) => (
    <del className="text-sf-text-secondary line-through">{children}</del>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sf-accent underline transition-colors hover:text-sf-accent-dim"
    >
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul className="mb-3 list-disc pl-6 text-sm text-sf-text-primary [&>li]:mb-1">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 list-decimal pl-6 text-sm text-sf-text-primary [&>li]:mb-1">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-7">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="mb-3 border-l-4 border-sf-accent pl-4 italic text-sf-text-secondary">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-6 border-sf-border" />,
  table: ({ children }) => (
    <div className="mb-4 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="border-b border-sf-border">{children}</thead>
  ),
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => (
    <tr className="border-b border-sf-border/50 transition-colors hover:bg-sf-bg-hover">
      {children}
    </tr>
  ),
  th: ({ children }) => (
    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-sf-text-secondary">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-sf-text-primary">{children}</td>
  ),
  pre: ({ node, children }) => {
    // Detect mermaid code block: skip the pre box so MermaidDiagram renders unboxed
    const firstChild = (node as unknown as HastNode | undefined)?.children?.[0];
    const classList: string[] =
      firstChild?.type === "element"
        ? (firstChild.properties?.className ?? [])
        : [];
    const isMermaid = classList.includes("language-mermaid");

    if (isMermaid) {
      // Let the code component handle rendering MermaidDiagram directly
      return <>{children}</>;
    }

    return (
      <pre className="mb-4 overflow-x-auto rounded-sf border border-sf-border bg-sf-bg-tertiary">
        {children}
      </pre>
    );
  },
  code: ({ className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className ?? "");
    const language = match?.[1];

    if (language === "mermaid") {
      return <MermaidDiagram chart={String(children).trim()} />;
    }

    // Fenced code block — has a className from rehype-highlight
    if (className) {
      return (
        <code
          className={`${className} block p-4 font-code text-[0.8125rem] text-sf-accent`}
          {...props}
        >
          {children}
        </code>
      );
    }

    // Inline code
    return (
      <code
        className="rounded bg-sf-bg-tertiary px-1.5 py-0.5 font-code text-[0.8125rem] text-sf-accent"
        {...props}
      >
        {children}
      </code>
    );
  },
  img: ({ src, alt }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt ?? ""}
      className="my-4 max-w-full rounded-sf border border-sf-border"
    />
  ),
  };
}

// --- BlogPostPreview ---

export interface BlogPostPreviewProps {
  markdown: string;
  onCitationClick?: (type: string, label: string) => void;
}

export function BlogPostPreview({ markdown, onCitationClick }: BlogPostPreviewProps) {
  const components = createMarkdownComponents(onCitationClick);

  return (
    <div className="h-full overflow-y-auto">
      <article className="mx-auto max-w-2xl p-6">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[[rehypeHighlight, { ignoreMissing: true }]]}
          components={components}
        >
          {markdown}
        </ReactMarkdown>
      </article>
    </div>
  );
}
