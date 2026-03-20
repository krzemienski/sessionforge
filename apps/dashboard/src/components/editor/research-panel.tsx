"use client";

import { useState, useCallback } from "react";
import { Copy, Check, Pencil, Trash2, Plus, X, Star, ClipboardPaste } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

export type ResearchItemType = "link" | "note" | "code_snippet" | "session_snippet";

export interface ResearchItem {
  id: string;
  type: ResearchItemType;
  title: string;
  content: string;
  url?: string;
  tags: string[];
  credibility: number; // 1-5
  createdAt: string;
}

export interface ResearchPanelProps {
  postId: string;
  items?: ResearchItem[];
  onAddItem?: (item: Omit<ResearchItem, "id" | "createdAt">) => void;
  onUpdateItem?: (id: string, item: Partial<ResearchItem>) => void;
  onDeleteItem?: (id: string) => void;
  onInsertIntoDraft?: (item: ResearchItem) => void;
}

// ── Type config ─────────────────────────────────────────────────────────────

interface TypeConfig {
  icon: string;
  color: string;
  bgColor: string;
  label: string;
}

const TYPE_CONFIG: Record<ResearchItemType, TypeConfig> = {
  link: {
    icon: "\uD83D\uDD17",
    color: "text-blue-400",
    bgColor: "bg-blue-500/15",
    label: "Link",
  },
  note: {
    icon: "\uD83D\uDCDD",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/15",
    label: "Note",
  },
  code_snippet: {
    icon: "\u2728",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/15",
    label: "Code Snippet",
  },
  session_snippet: {
    icon: "\uD83D\uDCAC",
    color: "text-purple-400",
    bgColor: "bg-purple-500/15",
    label: "Session Snippet",
  },
};

const TYPE_OPTIONS: { value: ResearchItemType; label: string }[] = [
  { value: "link", label: "Link" },
  { value: "note", label: "Note" },
  { value: "code_snippet", label: "Code Snippet" },
  { value: "session_snippet", label: "Session Snippet" },
];

// ── Credibility stars ──────────────────────────────────────────────────────

interface CredibilityStarsProps {
  rating: number;
  interactive?: boolean;
  onChange?: (rating: number) => void;
}

function CredibilityStars({ rating, interactive = false, onChange }: CredibilityStarsProps) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!interactive}
          onClick={() => onChange?.(star)}
          className={cn(
            "text-[11px] transition-colors",
            interactive
              ? "cursor-pointer hover:text-amber-300"
              : "cursor-default",
            star <= rating ? "text-amber-400" : "text-sf-text-muted/30"
          )}
        >
          <Star size={11} fill={star <= rating ? "currentColor" : "none"} />
        </button>
      ))}
    </div>
  );
}

// ── Tag chip ───────────────────────────────────────────────────────────────

interface TagChipProps {
  tag: string;
  active?: boolean;
  removable?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
}

function TagChip({ tag, active = false, removable = false, onClick, onRemove }: TagChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors",
        active
          ? "bg-sf-accent/20 text-sf-accent"
          : "bg-sf-bg-secondary text-sf-text-muted hover:text-sf-text-secondary",
        onClick && "cursor-pointer"
      )}
      onClick={onClick}
    >
      {tag}
      {removable && onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 hover:text-red-400 transition-colors"
        >
          <X size={8} />
        </button>
      )}
    </span>
  );
}

// ── Research card ──────────────────────────────────────────────────────────

interface ResearchCardProps {
  item: ResearchItem;
  onEdit?: () => void;
  onDelete?: () => void;
  onInsert?: () => void;
}

function ResearchCard({ item, onEdit, onDelete, onInsert }: ResearchCardProps) {
  const [copied, setCopied] = useState(false);
  const config = TYPE_CONFIG[item.type];

  const handleCopy = useCallback(async () => {
    const text = item.type === "link" && item.url
      ? `[${item.title}](${item.url})\n${item.content}`
      : item.content;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [item]);

  return (
    <div className="bg-sf-bg-tertiary border border-sf-border rounded-sf p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${config.bgColor} ${config.color}`}
        >
          <span>{config.icon}</span>
          <span>{config.label}</span>
        </span>
        <CredibilityStars rating={item.credibility} />
      </div>

      {/* Title */}
      <p className="text-xs font-medium text-sf-text-primary truncate">{item.title}</p>

      {/* URL (for links) */}
      {item.type === "link" && item.url && (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-sf-accent hover:underline truncate block mt-0.5"
        >
          {item.url}
        </a>
      )}

      {/* Content preview */}
      <p
        className={cn(
          "text-xs text-sf-text-secondary mt-1.5 leading-relaxed line-clamp-3",
          item.type === "code_snippet" && "font-mono"
        )}
      >
        {item.content}
      </p>

      {/* Tags */}
      {item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {item.tags.map((tag) => (
            <TagChip key={tag} tag={tag} />
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 pt-1 border-t border-sf-border mt-2">
        <button
          onClick={() => onInsert?.()}
          className="flex items-center gap-1 px-2 py-1 text-[11px] text-sf-accent hover:bg-sf-accent/10 rounded-sf transition-colors"
        >
          <ClipboardPaste size={11} />
          Insert
        </button>
        <button
          onClick={handleCopy}
          className={cn(
            "flex items-center gap-1 px-2 py-1 text-[11px] rounded-sf transition-colors",
            copied
              ? "text-sf-success"
              : "text-sf-text-secondary hover:text-sf-text-primary hover:bg-sf-bg-secondary"
          )}
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          onClick={() => onEdit?.()}
          className="flex items-center gap-1 px-2 py-1 text-[11px] text-sf-text-secondary hover:text-sf-text-primary hover:bg-sf-bg-secondary rounded-sf transition-colors"
        >
          <Pencil size={11} />
          Edit
        </button>
        <button
          onClick={() => onDelete?.()}
          className="flex items-center gap-1 px-2 py-1 text-[11px] text-sf-text-secondary hover:text-red-400 hover:bg-sf-bg-secondary rounded-sf transition-colors ml-auto"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}

// ── Add item form ──────────────────────────────────────────────────────────

interface AddItemFormProps {
  onSubmit: (item: Omit<ResearchItem, "id" | "createdAt">) => void;
  onCancel: () => void;
}

function AddItemForm({ onSubmit, onCancel }: AddItemFormProps) {
  const [type, setType] = useState<ResearchItemType>("note");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [credibility, setCredibility] = useState(3);

  const handleAddTag = useCallback(() => {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed]);
      setTagInput("");
    }
  }, [tagInput, tags]);

  const handleRemoveTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  const handleTagKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddTag();
      }
    },
    [handleAddTag]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!title.trim() || !content.trim()) return;
      onSubmit({
        type,
        title: title.trim(),
        content: content.trim(),
        url: type === "link" ? url.trim() : undefined,
        tags,
        credibility,
      });
    },
    [type, title, content, url, tags, credibility, onSubmit]
  );

  const inputClass =
    "w-full bg-sf-bg-secondary border border-sf-border rounded-sf px-2.5 py-1.5 text-xs text-sf-text-primary focus:outline-none focus:border-sf-border-focus";

  return (
    <form onSubmit={handleSubmit} className="p-3 space-y-2.5 border-b border-sf-border bg-sf-bg-secondary/50">
      {/* Type selector */}
      <select
        value={type}
        onChange={(e) => setType(e.target.value as ResearchItemType)}
        className={inputClass}
      >
        {TYPE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Title */}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        className={inputClass}
        required
      />

      {/* URL (for links) */}
      {type === "link" && (
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
          className={inputClass}
        />
      )}

      {/* Content */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={type === "code_snippet" ? "Paste code here..." : "Notes or content..."}
        rows={4}
        className={cn(inputClass, "resize-y", type === "code_snippet" && "font-mono")}
        required
      />

      {/* Tags */}
      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            placeholder="Add tag..."
            className={cn(inputClass, "flex-1")}
          />
          <button
            type="button"
            onClick={handleAddTag}
            className="px-2 py-1.5 text-xs bg-sf-bg-tertiary border border-sf-border rounded-sf text-sf-text-secondary hover:text-sf-text-primary transition-colors"
          >
            <Plus size={12} />
          </button>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <TagChip
                key={tag}
                tag={tag}
                removable
                onRemove={() => handleRemoveTag(tag)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Credibility */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-sf-text-muted uppercase tracking-wide">
          Credibility
        </span>
        <CredibilityStars rating={credibility} interactive onChange={setCredibility} />
      </div>

      {/* Form actions */}
      <div className="flex items-center gap-2 justify-end pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-2.5 py-1 text-xs text-sf-text-secondary hover:text-sf-text-primary transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex items-center gap-1 px-2.5 py-1 text-xs bg-sf-accent text-sf-bg-primary rounded-sf hover:bg-sf-accent-dim transition-colors"
        >
          <Plus size={11} />
          Add Item
        </button>
      </div>
    </form>
  );
}

// ── Edit item form ─────────────────────────────────────────────────────────

interface EditItemFormProps {
  item: ResearchItem;
  onSave: (id: string, updates: Partial<ResearchItem>) => void;
  onCancel: () => void;
}

function EditItemForm({ item, onSave, onCancel }: EditItemFormProps) {
  const [title, setTitle] = useState(item.title);
  const [content, setContent] = useState(item.content);
  const [url, setUrl] = useState(item.url ?? "");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(item.tags);
  const [credibility, setCredibility] = useState(item.credibility);

  const handleAddTag = useCallback(() => {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed]);
      setTagInput("");
    }
  }, [tagInput, tags]);

  const handleRemoveTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  const handleTagKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddTag();
      }
    },
    [handleAddTag]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!title.trim() || !content.trim()) return;
      onSave(item.id, {
        title: title.trim(),
        content: content.trim(),
        url: item.type === "link" ? url.trim() : undefined,
        tags,
        credibility,
      });
    },
    [item.id, item.type, title, content, url, tags, credibility, onSave]
  );

  const inputClass =
    "w-full bg-sf-bg-secondary border border-sf-border rounded-sf px-2.5 py-1.5 text-xs text-sf-text-primary focus:outline-none focus:border-sf-border-focus";

  return (
    <form onSubmit={handleSubmit} className="p-3 space-y-2.5 bg-sf-bg-secondary/50 border border-sf-accent/20 rounded-sf">
      {/* Title */}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        className={inputClass}
        required
      />

      {/* URL (for links) */}
      {item.type === "link" && (
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
          className={inputClass}
        />
      )}

      {/* Content */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Content..."
        rows={4}
        className={cn(inputClass, "resize-y", item.type === "code_snippet" && "font-mono")}
        required
      />

      {/* Tags */}
      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            placeholder="Add tag..."
            className={cn(inputClass, "flex-1")}
          />
          <button
            type="button"
            onClick={handleAddTag}
            className="px-2 py-1.5 text-xs bg-sf-bg-tertiary border border-sf-border rounded-sf text-sf-text-secondary hover:text-sf-text-primary transition-colors"
          >
            <Plus size={12} />
          </button>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <TagChip
                key={tag}
                tag={tag}
                removable
                onRemove={() => handleRemoveTag(tag)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Credibility */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-sf-text-muted uppercase tracking-wide">
          Credibility
        </span>
        <CredibilityStars rating={credibility} interactive onChange={setCredibility} />
      </div>

      {/* Form actions */}
      <div className="flex items-center gap-2 justify-end pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-2.5 py-1 text-xs text-sf-text-secondary hover:text-sf-text-primary transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex items-center gap-1 px-2.5 py-1 text-xs bg-sf-accent text-sf-bg-primary rounded-sf hover:bg-sf-accent-dim transition-colors"
        >
          Save
        </button>
      </div>
    </form>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center">
        <div className="text-3xl mb-3 opacity-40">
          {"\uD83D\uDCDA"}
        </div>
        <p className="text-sm text-sf-text-muted">No research items yet.</p>
        <p className="text-xs text-sf-text-muted mt-1">
          Click &ldquo;Add Item&rdquo; to start collecting research for your post.
        </p>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function ResearchPanel({
  items = [],
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onInsertIntoDraft,
}: ResearchPanelProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);

  // Collect all unique tags
  const allTags = Array.from(new Set(items.flatMap((item) => item.tags))).sort();

  // Filter items by tag
  const filtered = activeTagFilter
    ? items.filter((item) => item.tags.includes(activeTagFilter))
    : items;

  // Group by type
  const grouped = filtered.reduce<Record<ResearchItemType, ResearchItem[]>>(
    (acc, item) => {
      if (!acc[item.type]) acc[item.type] = [];
      acc[item.type].push(item);
      return acc;
    },
    {} as Record<ResearchItemType, ResearchItem[]>
  );

  const handleAddItem = useCallback(
    (item: Omit<ResearchItem, "id" | "createdAt">) => {
      onAddItem?.(item);
      setShowAddForm(false);
    },
    [onAddItem]
  );

  const handleSaveEdit = useCallback(
    (id: string, updates: Partial<ResearchItem>) => {
      onUpdateItem?.(id, updates);
      setEditingId(null);
    },
    [onUpdateItem]
  );

  const handleInsert = useCallback(
    (item: ResearchItem) => {
      if (onInsertIntoDraft) {
        onInsertIntoDraft(item);
      } else {
        // Default: copy formatted content to clipboard
        const text =
          item.type === "code_snippet"
            ? `\`\`\`\n${item.content}\n\`\`\``
            : item.type === "link" && item.url
              ? `[${item.title}](${item.url})`
              : item.content;
        navigator.clipboard.writeText(text);
      }
    },
    [onInsertIntoDraft]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-sf-border flex items-center justify-between">
        <h3 className="font-display font-semibold text-sf-text-primary text-sm">
          Research
        </h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-sf font-medium text-xs transition-colors",
            showAddForm
              ? "bg-sf-bg-tertiary text-sf-text-secondary border border-sf-border"
              : "bg-sf-accent text-sf-bg-primary hover:bg-sf-accent-dim"
          )}
        >
          {showAddForm ? (
            <>
              <X size={13} />
              Cancel
            </>
          ) : (
            <>
              <Plus size={13} />
              Add Item
            </>
          )}
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <AddItemForm
          onSubmit={handleAddItem}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* Tag filter chips */}
      {allTags.length > 0 && (
        <div className="flex gap-1 p-3 border-b border-sf-border flex-wrap">
          <TagChip
            tag="All"
            active={activeTagFilter === null}
            onClick={() => setActiveTagFilter(null)}
          />
          {allTags.map((tag) => (
            <TagChip
              key={tag}
              tag={tag}
              active={activeTagFilter === tag}
              onClick={() =>
                setActiveTagFilter(activeTagFilter === tag ? null : tag)
              }
            />
          ))}
        </div>
      )}

      {/* Content */}
      {items.length === 0 && !showAddForm ? (
        <EmptyState />
      ) : filtered.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-xs text-sf-text-muted text-center">
            No items match the selected tag.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 space-y-4 min-h-0">
          {(Object.entries(grouped) as [ResearchItemType, ResearchItem[]][]).map(
            ([type, groupItems]) => (
              <div key={type}>
                {/* Group header */}
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${TYPE_CONFIG[type].bgColor} ${TYPE_CONFIG[type].color}`}
                  >
                    <span>{TYPE_CONFIG[type].icon}</span>
                    <span>{TYPE_CONFIG[type].label}</span>
                  </span>
                  <span className="text-[10px] text-sf-text-muted">
                    {groupItems.length}
                  </span>
                </div>

                {/* Items */}
                <div className="space-y-2">
                  {groupItems.map((item) =>
                    editingId === item.id ? (
                      <EditItemForm
                        key={item.id}
                        item={item}
                        onSave={handleSaveEdit}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <ResearchCard
                        key={item.id}
                        item={item}
                        onEdit={() => setEditingId(item.id)}
                        onDelete={() => onDeleteItem?.(item.id)}
                        onInsert={() => handleInsert(item)}
                      />
                    )
                  )}
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* Summary */}
      {items.length > 0 && (
        <div className="px-4 py-2 border-t border-sf-border text-xs text-sf-text-muted">
          {filtered.length} of {items.length} items
          {activeTagFilter && (
            <span>
              {" "}
              &middot; filtered by &ldquo;{activeTagFilter}&rdquo;
            </span>
          )}
        </div>
      )}
    </div>
  );
}
