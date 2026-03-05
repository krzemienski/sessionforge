"use client";

import { useEffect, useState } from "react";
import { Sparkles, Save, AlertCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MetaData {
  metaTitle: string | null;
  metaDescription: string | null;
  ogImage: string | null;
}

interface MetaSuggestions {
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  ogImagePrompt: string;
}

interface MetaFieldsProps {
  postId: string;
  /** Called after meta fields are saved so parent can update state */
  onSave?: (meta: MetaData) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TITLE_LIMIT = 60;
const DESCRIPTION_LIMIT = 160;

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

function CharCounter({
  current,
  limit,
}: {
  current: number;
  limit: number;
}) {
  const remaining = limit - current;
  const isOver = remaining < 0;
  const isWarning = remaining >= 0 && remaining <= 10;

  return (
    <span
      className={cn(
        "text-[10px] tabular-nums",
        isOver
          ? "text-red-500 font-semibold"
          : isWarning
          ? "text-yellow-500"
          : "text-sf-text-muted"
      )}
    >
      {current} / {limit}
    </span>
  );
}

function FieldLabel({
  label,
  hint,
}: {
  label: string;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <label className="text-xs font-semibold text-sf-text-muted uppercase tracking-wider">
        {label}
      </label>
      {hint && (
        <span className="text-[10px] text-sf-text-muted">{hint}</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function MetaFields({ postId, onSave }: MetaFieldsProps) {
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [ogImage, setOgImage] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">(
    "idle"
  );
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Load existing meta data
  useEffect(() => {
    let cancelled = false;

    fetch(`/api/content/${postId}/seo`)
      .then((res) => {
        if (!res.ok) return null;
        return res.json() as Promise<MetaData>;
      })
      .then((json) => {
        if (!cancelled && json) {
          setMetaTitle(json.metaTitle ?? "");
          setMetaDescription(json.metaDescription ?? "");
          setOgImage(json.ogImage ?? "");
          setLoading(false);
        } else if (!cancelled) {
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [postId]);

  async function handleSave() {
    setSaving(true);
    setSaveStatus("idle");

    try {
      const res = await fetch(`/api/content/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metaTitle: metaTitle || null,
          metaDescription: metaDescription || null,
          ogImage: ogImage || null,
        }),
      });

      if (!res.ok) throw new Error("Save failed");

      setSaveStatus("saved");
      onSave?.({
        metaTitle: metaTitle || null,
        metaDescription: metaDescription || null,
        ogImage: ogImage || null,
      });

      // Reset status after 2 seconds
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateWithAI() {
    setGenerating(true);
    setGenerateError(null);

    try {
      const res = await fetch(`/api/content/${postId}/seo/generate-meta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? "AI generation failed"
        );
      }

      const suggestions = (await res.json()) as MetaSuggestions;
      setMetaTitle(suggestions.metaTitle ?? "");
      setMetaDescription(suggestions.metaDescription ?? "");
    } catch (err) {
      setGenerateError(
        err instanceof Error ? err.message : "AI generation failed"
      );
    } finally {
      setGenerating(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="border border-sf-border rounded-sf bg-sf-bg-secondary p-4 space-y-4">
        <SkeletonLine className="w-32" />
        <div className="space-y-2">
          <SkeletonLine className="w-24" />
          <SkeletonLine className="w-full h-8" />
        </div>
        <div className="space-y-2">
          <SkeletonLine className="w-28" />
          <SkeletonLine className="w-full h-16" />
        </div>
        <div className="space-y-2">
          <SkeletonLine className="w-20" />
          <SkeletonLine className="w-full h-8" />
        </div>
        <SkeletonLine className="w-full h-8" />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="border border-sf-border rounded-sf bg-sf-bg-secondary p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-sf-text-muted uppercase tracking-wider">
          Meta Fields
        </h3>

        {/* Generate with AI button */}
        <button
          onClick={handleGenerateWithAI}
          disabled={generating}
          className={cn(
            "flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded border transition-colors",
            generating
              ? "opacity-60 cursor-not-allowed border-sf-border text-sf-text-muted"
              : "border-sf-accent/40 text-sf-accent hover:bg-sf-accent/10"
          )}
          title="Generate meta title and description using AI"
        >
          <Sparkles size={11} className={cn(generating && "animate-pulse")} />
          {generating ? "Generating…" : "AI Suggest"}
        </button>
      </div>

      {/* AI error */}
      {generateError && (
        <div className="flex items-start gap-2 p-2.5 rounded bg-red-500/5 border border-red-500/20 text-xs text-red-400">
          <AlertCircle size={11} className="flex-shrink-0 mt-0.5" />
          <span>{generateError}</span>
        </div>
      )}

      {/* Meta Title */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <FieldLabel label="Meta Title" hint="Ideal: 50–60 chars" />
          <CharCounter current={metaTitle.length} limit={TITLE_LIMIT} />
        </div>
        <input
          type="text"
          value={metaTitle}
          onChange={(e) => setMetaTitle(e.target.value)}
          placeholder="Enter meta title…"
          maxLength={TITLE_LIMIT + 20}
          className={cn(
            "w-full px-3 py-2 text-sm rounded border bg-sf-bg-primary text-sf-text-primary placeholder:text-sf-text-muted",
            "focus:outline-none focus:ring-1 focus:ring-sf-accent/50 transition-colors",
            metaTitle.length > TITLE_LIMIT
              ? "border-red-500/60"
              : "border-sf-border"
          )}
        />
        {metaTitle.length > TITLE_LIMIT && (
          <p className="text-[10px] text-red-500">
            {metaTitle.length - TITLE_LIMIT} character
            {metaTitle.length - TITLE_LIMIT !== 1 ? "s" : ""} over limit — may
            be truncated in search results.
          </p>
        )}
      </div>

      {/* Meta Description */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <FieldLabel
            label="Meta Description"
            hint="Ideal: 150–160 chars"
          />
          <CharCounter
            current={metaDescription.length}
            limit={DESCRIPTION_LIMIT}
          />
        </div>
        <textarea
          value={metaDescription}
          onChange={(e) => setMetaDescription(e.target.value)}
          placeholder="Enter meta description…"
          rows={3}
          maxLength={DESCRIPTION_LIMIT + 40}
          className={cn(
            "w-full px-3 py-2 text-sm rounded border bg-sf-bg-primary text-sf-text-primary placeholder:text-sf-text-muted resize-none",
            "focus:outline-none focus:ring-1 focus:ring-sf-accent/50 transition-colors",
            metaDescription.length > DESCRIPTION_LIMIT
              ? "border-red-500/60"
              : "border-sf-border"
          )}
        />
        {metaDescription.length > DESCRIPTION_LIMIT && (
          <p className="text-[10px] text-red-500">
            {metaDescription.length - DESCRIPTION_LIMIT} character
            {metaDescription.length - DESCRIPTION_LIMIT !== 1 ? "s" : ""} over
            limit — may be truncated in search results.
          </p>
        )}
      </div>

      {/* OG Image URL */}
      <div className="space-y-1.5">
        <FieldLabel
          label="OG Image URL"
          hint="1200 × 630 px recommended"
        />
        <input
          type="url"
          value={ogImage}
          onChange={(e) => setOgImage(e.target.value)}
          placeholder="https://example.com/image.png"
          className={cn(
            "w-full px-3 py-2 text-sm rounded border border-sf-border bg-sf-bg-primary text-sf-text-primary placeholder:text-sf-text-muted",
            "focus:outline-none focus:ring-1 focus:ring-sf-accent/50 transition-colors"
          )}
        />
        {ogImage && (
          <div className="mt-2 rounded overflow-hidden border border-sf-border">
            <img
              src={ogImage}
              alt="OG image preview"
              className="w-full h-24 object-cover bg-sf-bg-tertiary"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        )}
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className={cn(
          "w-full flex items-center justify-center gap-2 py-2 px-4 rounded border text-sm font-medium transition-colors",
          saving
            ? "opacity-60 cursor-not-allowed border-sf-border text-sf-text-muted"
            : saveStatus === "saved"
            ? "border-green-500/40 bg-green-500/10 text-green-500"
            : saveStatus === "error"
            ? "border-red-500/40 bg-red-500/10 text-red-400"
            : "border-sf-border hover:border-sf-accent/40 hover:bg-sf-accent/5 text-sf-text-secondary"
        )}
      >
        {saveStatus === "saved" ? (
          <>
            <CheckCircle size={13} />
            Saved
          </>
        ) : saveStatus === "error" ? (
          <>
            <AlertCircle size={13} />
            Save failed — try again
          </>
        ) : (
          <>
            <Save size={13} />
            {saving ? "Saving…" : "Save Meta Fields"}
          </>
        )}
      </button>
    </div>
  );
}
