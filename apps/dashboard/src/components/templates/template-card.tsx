"use client";

import type { ContentTemplate } from "@/types/templates";
import { FileText, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface TemplateCardProps {
  template: ContentTemplate;
  selected?: boolean;
  onSelect?: (template: ContentTemplate) => void;
}

export function TemplateCard({ template, selected, onSelect }: TemplateCardProps) {
  const sectionCount = template.structure?.sections?.length || 0;
  const isBuiltIn = template.templateType === "built_in";

  return (
    <button
      onClick={() => onSelect?.(template)}
      className={cn(
        "relative w-full text-left p-4 rounded-sf-lg border transition-all",
        "hover:border-sf-accent hover:bg-sf-bg-hover",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sf-accent focus-visible:ring-offset-2 focus-visible:ring-offset-sf-bg-primary",
        selected
          ? "border-sf-accent bg-sf-accent-bg"
          : "border-sf-border bg-sf-bg-secondary"
      )}
    >
      {selected && (
        <div className="absolute top-3 right-3 w-5 h-5 bg-sf-accent rounded-full flex items-center justify-center">
          <Check size={12} className="text-sf-bg-primary" />
        </div>
      )}

      <div className="flex items-start gap-3 mb-3">
        <div className={cn(
          "w-10 h-10 rounded-sf flex items-center justify-center flex-shrink-0",
          selected ? "bg-sf-accent/20" : "bg-sf-bg-tertiary"
        )}>
          <FileText size={20} className={selected ? "text-sf-accent" : "text-sf-text-secondary"} />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-display font-semibold text-sf-text-primary mb-1">
            {template.name}
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn(
              "px-2 py-0.5 rounded-sf-full text-xs font-medium",
              isBuiltIn
                ? "bg-sf-accent/10 text-sf-accent"
                : "bg-sf-bg-tertiary text-sf-text-secondary"
            )}>
              {isBuiltIn ? "Built-in" : "Custom"}
            </span>
            <span className="text-xs text-sf-text-muted capitalize">
              {template.contentType.replace(/_/g, " ")}
            </span>
          </div>
        </div>
      </div>

      {template.description && (
        <p className="text-sm text-sf-text-secondary line-clamp-2 mb-3">
          {template.description}
        </p>
      )}

      <div className="flex items-center justify-between text-xs text-sf-text-muted">
        <span>{sectionCount} section{sectionCount !== 1 ? "s" : ""}</span>
        {template.usageCount && template.usageCount > 0 && (
          <span>{template.usageCount} use{template.usageCount !== 1 ? "s" : ""}</span>
        )}
      </div>
    </button>
  );
}
