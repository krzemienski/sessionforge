"use client";

import { useState } from "react";
import { useTemplates } from "@/hooks/use-templates";
import { TemplateCard } from "./template-card";
import type { ContentTemplate, ContentType } from "@/types/templates";
import { Search, Filter } from "lucide-react";

interface TemplateSelectorProps {
  workspace: string;
  contentType?: ContentType;
  selectedTemplateId?: string;
  onSelect: (template: ContentTemplate) => void;
  showFilters?: boolean;
}

export function TemplateSelector({
  workspace,
  contentType,
  selectedTemplateId,
  onSelect,
  showFilters = true,
}: TemplateSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "built_in" | "custom">("all");

  const templates = useTemplates(workspace, contentType ? { contentType } : undefined);

  if (templates.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-6 bg-sf-bg-tertiary rounded w-1/4 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-sf-bg-tertiary rounded-sf-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (templates.error) {
    return (
      <div className="text-sm text-sf-text-muted">
        Failed to load templates. Please try again.
      </div>
    );
  }

  // Filter templates based on search and filter type
  const filteredTemplates = templates.data?.filter((template) => {
    const matchesSearch = !searchQuery ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter = filterType === "all" || template.templateType === filterType;

    return matchesSearch && matchesFilter;
  }) || [];

  return (
    <div className="space-y-4">
      {showFilters && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-sf-text-muted" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-sf-bg-tertiary border border-sf-border rounded-sf text-sm text-sf-text-primary placeholder:text-sf-text-muted focus:outline-none focus:border-sf-accent"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={16} className="text-sf-text-muted" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as typeof filterType)}
              className="px-3 py-2 bg-sf-bg-tertiary border border-sf-border rounded-sf text-sm text-sf-text-primary focus:outline-none focus:border-sf-accent"
            >
              <option value="all">All Templates</option>
              <option value="built_in">Built-in</option>
              <option value="custom">Custom</option>
            </select>
          </div>
        </div>
      )}

      {filteredTemplates.length === 0 ? (
        <div className="text-center py-8 text-sm text-sf-text-muted">
          {searchQuery || filterType !== "all"
            ? "No templates match your filters."
            : "No templates available."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              selected={template.id === selectedTemplateId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
