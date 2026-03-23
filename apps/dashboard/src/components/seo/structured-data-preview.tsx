"use client";

import { useEffect, useState } from "react";
import {
  Code2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Info,
  FileCode,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ValidationResult, ValidationIssue } from "@/lib/seo/structured-data-validator";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SchemaType = "TechArticle" | "Article" | "BlogPosting" | "HowTo" | "FAQPage" | "SoftwareApplication";

interface StructuredDataResponse {
  structuredData: Record<string, unknown> | null;
}

interface StructuredDataPreviewProps {
  postId: string;
}

// ---------------------------------------------------------------------------
// Schema type metadata
// ---------------------------------------------------------------------------

const SCHEMA_META: Record<string, { label: string; description: string }> = {
  TechArticle: {
    label: "TechArticle",
    description: "Technical content with code samples and proficiency targeting.",
  },
  Article: {
    label: "Article",
    description: "General article content with standard metadata.",
  },
  BlogPosting: {
    label: "BlogPosting",
    description: "Blog post content with authorship and publication dates.",
  },
  HowTo: {
    label: "HowTo",
    description: "Step-by-step tutorial with time estimates and structured steps.",
  },
  FAQPage: {
    label: "FAQPage",
    description: "FAQ content with structured question-and-answer pairs.",
  },
  SoftwareApplication: {
    label: "SoftwareApplication",
    description: "Software product with category, OS, and pricing metadata.",
  },
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SkeletonLine({ className }: { className?: string }) {
  return (
    <div
      className={cn("h-3 rounded bg-sf-bg-tertiary animate-pulse", className)}
    />
  );
}

function SchemaTypeBadge({ type }: { type: string }) {
  const meta = SCHEMA_META[type];
  const label = meta?.label ?? type;

  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-sf-accent/10 text-sf-accent">
      <FileCode size={10} className="flex-shrink-0" />
      {label}
    </span>
  );
}

function SchemaDescription({ type }: { type: string }) {
  const meta = SCHEMA_META[type];
  if (!meta) return null;

  return (
    <p className="text-[10px] text-sf-text-muted leading-relaxed">
      {meta.description}
    </p>
  );
}

function JsonLdPreview({
  jsonLd,
  expanded,
  onToggle,
}: {
  jsonLd: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded border border-sf-border bg-sf-bg-tertiary overflow-hidden">
      {/* Toggle header */}
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full px-3 py-2 text-xs font-medium text-sf-text-secondary hover:bg-sf-bg-primary transition-colors select-none"
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-1.5">
          <Code2 size={12} className="text-sf-text-muted" />
          JSON-LD Markup
        </span>
        {expanded ? (
          <ChevronUp size={13} className="text-sf-text-muted" />
        ) : (
          <ChevronDown size={13} className="text-sf-text-muted" />
        )}
      </button>

      {/* Collapsible code preview */}
      {expanded && (
        <div className="border-t border-sf-border">
          <pre className="p-3 text-[11px] leading-relaxed text-sf-text-secondary overflow-x-auto max-h-64 font-code">
            {jsonLd}
          </pre>
        </div>
      )}
    </div>
  );
}

function ValidationSummary({
  result,
}: {
  result: ValidationResult;
}) {
  const { valid, errorCount, warningCount } = result;

  return (
    <div
      className={cn(
        "flex items-center justify-between px-3 py-2 rounded border text-xs font-medium",
        valid
          ? "bg-green-500/5 border-green-500/20 text-green-500"
          : errorCount > 0
          ? "bg-red-500/5 border-red-500/20 text-red-400"
          : "bg-yellow-500/5 border-yellow-500/20 text-yellow-500"
      )}
    >
      <span className="flex items-center gap-1.5">
        {valid ? (
          <CheckCircle2 size={12} />
        ) : errorCount > 0 ? (
          <XCircle size={12} />
        ) : (
          <AlertTriangle size={12} />
        )}
        {valid
          ? "Validation passed"
          : `${errorCount} error${errorCount !== 1 ? "s" : ""}, ${warningCount} warning${warningCount !== 1 ? "s" : ""}`}
      </span>
      {valid && (
        <span className="text-[10px] font-normal text-sf-text-muted">
          Rich Results eligible
        </span>
      )}
    </div>
  );
}

function ValidationIssueItem({ issue }: { issue: ValidationIssue }) {
  const isError = issue.severity === "error";

  return (
    <div className="flex items-start gap-2.5 p-2.5 rounded border border-sf-border bg-sf-bg-tertiary">
      {isError ? (
        <XCircle
          size={13}
          className="flex-shrink-0 mt-0.5 text-red-500"
          aria-label="Error"
        />
      ) : (
        <AlertTriangle
          size={13}
          className="flex-shrink-0 mt-0.5 text-yellow-500"
          aria-label="Warning"
        />
      )}

      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-xs font-medium",
            isError ? "text-sf-text-primary" : "text-sf-text-secondary"
          )}
        >
          {issue.message}
        </p>
        <span
          className={cn(
            "inline-block text-[10px] px-1.5 py-0.5 rounded-full mt-1 font-medium",
            isError
              ? "bg-red-500/10 text-red-500"
              : "bg-yellow-500/10 text-yellow-500"
          )}
        >
          {issue.path}
        </span>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <div className="h-8 w-8 rounded-full bg-sf-bg-tertiary flex items-center justify-center">
        <Code2 size={15} className="text-sf-text-muted" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-sf-text-secondary">
          No structured data generated
        </p>
        <p className="text-xs text-sf-text-muted max-w-[220px] leading-relaxed">
          Run SEO analysis to auto-generate JSON-LD structured data for rich
          snippets in Google, Perplexity, and AI search engines.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function StructuredDataPreview({ postId }: StructuredDataPreviewProps) {
  const [structuredData, setStructuredData] = useState<Record<string, unknown> | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [codeExpanded, setCodeExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Fetch the post's SEO data which includes structuredData
    fetch(`/api/content/${postId}/seo`)
      .then((res) => {
        if (!res.ok) return null;
        return res.json() as Promise<StructuredDataResponse>;
      })
      .then((json) => {
        if (cancelled) return;

        const sd = json?.structuredData ?? null;
        setStructuredData(sd);

        // If we have structured data, validate it
        if (sd && typeof sd === "object") {
          return fetch(`/api/content/${postId}/seo/validate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ structuredData: sd }),
          })
            .then((res) => {
              if (!res.ok) return null;
              return res.json() as Promise<ValidationResult>;
            })
            .then((result) => {
              if (!cancelled && result) {
                setValidation(result);
              }
            });
        }
      })
      .catch(() => {
        // Silently handle fetch errors
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [postId]);

  // Loading state
  if (loading) {
    return (
      <div className="border border-sf-border rounded-sf bg-sf-bg-secondary p-4 space-y-3">
        <SkeletonLine className="w-40" />
        <SkeletonLine className="w-24 h-5" />
        <SkeletonLine className="w-full h-10" />
        <SkeletonLine className="w-full h-8" />
        {[0, 1, 2].map((i) => (
          <SkeletonLine key={i} className="w-full h-10" />
        ))}
      </div>
    );
  }

  // No structured data
  if (!structuredData) {
    return (
      <div className="border border-sf-border rounded-sf bg-sf-bg-secondary p-4 space-y-4">
        <div className="flex items-center gap-1.5">
          <Code2 size={13} className="text-sf-text-muted flex-shrink-0" />
          <h3 className="text-xs font-semibold text-sf-text-muted uppercase tracking-wider">
            Structured Data
          </h3>
        </div>
        <EmptyState />
      </div>
    );
  }

  const schemaType = (structuredData["@type"] as string) ?? "unknown";
  const jsonLd = JSON.stringify(structuredData, null, 2);
  const errors = validation?.issues.filter((i) => i.severity === "error") ?? [];
  const warnings = validation?.issues.filter((i) => i.severity === "warning") ?? [];

  return (
    <div className="border border-sf-border rounded-sf bg-sf-bg-secondary p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Code2 size={13} className="text-sf-text-muted flex-shrink-0" />
          <h3 className="text-xs font-semibold text-sf-text-muted uppercase tracking-wider">
            Structured Data
          </h3>
        </div>
        <SchemaTypeBadge type={schemaType} />
      </div>

      {/* Schema type description */}
      <SchemaDescription type={schemaType} />

      {/* Collapsible JSON-LD preview */}
      <JsonLdPreview
        jsonLd={jsonLd}
        expanded={codeExpanded}
        onToggle={() => setCodeExpanded((v) => !v)}
      />

      {/* Validation results */}
      {validation && (
        <>
          <ValidationSummary result={validation} />

          {/* Issue list */}
          {(errors.length > 0 || warnings.length > 0) && (
            <div className="space-y-2">
              {errors.map((issue, idx) => (
                <ValidationIssueItem key={`error-${idx}`} issue={issue} />
              ))}
              {warnings.map((issue, idx) => (
                <ValidationIssueItem key={`warning-${idx}`} issue={issue} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Info callout */}
      <div className="flex items-start gap-2 p-2.5 rounded bg-sf-bg-tertiary border border-sf-border text-xs text-sf-text-muted">
        <Info size={11} className="flex-shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          Structured data enables rich snippets in Google Search, knowledge
          panels, and AI-powered citations. Fix errors to ensure eligibility.
        </p>
      </div>
    </div>
  );
}
