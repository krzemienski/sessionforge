"use client";

import { useState, useEffect } from "react";
import { X, Plus, RefreshCw, Check } from "lucide-react";
import { useCreateTemplate } from "@/hooks/use-templates";
import type { ContentType, TemplateStructure } from "@/types/templates";

interface CreateTemplateDialogProps {
  postId: string;
  workspace: string;
  title: string;
  markdown: string;
  contentType: ContentType;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Extract template structure from markdown content by parsing headings
 */
function extractStructureFromMarkdown(markdown: string): TemplateStructure {
  const lines = markdown.split("\n");
  const sections: TemplateStructure["sections"] = [];

  for (const line of lines) {
    // Match h2 (##) and h3 (###) headings
    const h2Match = line.match(/^##\s+(.+)$/);
    const h3Match = line.match(/^###\s+(.+)$/);

    if (h2Match) {
      sections.push({
        heading: h2Match[1].trim(),
        description: `Main section: ${h2Match[1].trim()}`,
        required: true,
      });
    } else if (h3Match && sections.length > 0) {
      // H3 headings are subsections
      sections.push({
        heading: h3Match[1].trim(),
        description: `Subsection: ${h3Match[1].trim()}`,
        required: false,
      });
    }
  }

  // If no headings found, create a default structure
  if (sections.length === 0) {
    sections.push({
      heading: "Introduction",
      description: "Opening section",
      required: true,
    });
    sections.push({
      heading: "Main Content",
      description: "Core content section",
      required: true,
    });
    sections.push({
      heading: "Conclusion",
      description: "Closing section",
      required: false,
    });
  }

  return { sections };
}

/**
 * Generate a slug from template name
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function CreateTemplateDialog({
  postId,
  workspace,
  title,
  markdown,
  contentType,
  isOpen,
  onClose,
}: CreateTemplateDialogProps) {
  const [templateName, setTemplateName] = useState("");
  const [description, setDescription] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const createTemplate = useCreateTemplate(workspace);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setTemplateName(title ? `${title} Template` : "");
      setDescription(`Custom template based on: ${title}`);
      setErrorMessage(null);
    }
  }, [isOpen, title]);

  if (!isOpen) return null;

  async function handleSubmit() {
    setErrorMessage(null);

    if (!templateName.trim()) {
      setErrorMessage("Template name is required");
      return;
    }

    try {
      const structure = extractStructureFromMarkdown(markdown);
      const slug = slugify(templateName);

      await createTemplate.mutateAsync({
        name: templateName,
        slug,
        contentType,
        description: description.trim() || undefined,
        structure,
        toneGuidance: `Template created from: ${title}. Maintain similar style and structure.`,
        exampleContent: markdown.substring(0, 1000), // First 1000 chars as example
      });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "An unexpected error occurred");
    }
  }

  const isSuccess = createTemplate.isSuccess;
  const isPending = createTemplate.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-md bg-sf-bg-secondary border border-sf-border rounded-sf-lg shadow-xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold font-display text-sf-text-primary">
            Create Template from Post
          </h2>
          <button
            onClick={onClose}
            className="text-sf-text-secondary hover:text-sf-text-primary transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {isSuccess ? (
          /* Success state */
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-sf-success/10 flex items-center justify-center">
                <Check size={16} className="text-sf-success" />
              </div>
              <p className="text-sm text-sf-success font-medium">
                Template created successfully!
              </p>
            </div>
            <p className="text-sm text-sf-text-secondary">
              Your custom template &quot;{templateName}&quot; is now available for use when generating new content.
            </p>
            <div className="flex justify-end pt-2">
              <button
                onClick={onClose}
                className="bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Form state */
          <div className="space-y-4">
            {/* Info */}
            <p className="text-sm text-sf-text-secondary">
              Create a reusable template based on this post&apos;s structure. The template will extract headings and sections automatically.
            </p>

            {/* Template Name */}
            <div>
              <label className="block text-sm font-medium text-sf-text-secondary mb-1">
                Template Name
                <span className="ml-1 text-sf-error">*</span>
              </label>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="My Custom Template"
                className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus placeholder:text-sf-text-tertiary"
                autoFocus
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-sf-text-secondary mb-1">
                Description
                <span className="ml-1 text-sf-text-tertiary font-normal">(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe when to use this template..."
                rows={3}
                className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus placeholder:text-sf-text-tertiary resize-none"
              />
            </div>

            {/* Content Type (read-only) */}
            <div>
              <label className="block text-sm font-medium text-sf-text-secondary mb-1">
                Content Type
              </label>
              <div className="bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-muted capitalize">
                {contentType.replace(/_/g, " ")}
              </div>
            </div>

            {/* Structure Preview */}
            <div>
              <label className="block text-sm font-medium text-sf-text-secondary mb-1">
                Structure Preview
              </label>
              <div className="bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-xs text-sf-text-muted">
                {extractStructureFromMarkdown(markdown).sections.length} sections detected
              </div>
            </div>

            {/* Error */}
            {errorMessage && (
              <p className="text-sm text-sf-error">{errorMessage}</p>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                onClick={onClose}
                disabled={isPending}
                className="px-4 py-2 rounded-sf text-sm font-medium text-sf-text-secondary hover:text-sf-text-primary hover:bg-sf-bg-hover border border-sf-border transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isPending || !templateName.trim()}
                className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
              >
                {isPending ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Plus size={14} />
                )}
                {isPending ? "Creating..." : "Create Template"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
