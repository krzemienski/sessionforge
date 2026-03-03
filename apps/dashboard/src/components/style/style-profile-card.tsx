"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, X, Save, ChevronDown, ChevronUp } from "lucide-react";

// --- Types ---

interface HeadingStyle {
  preferredLevels: string[];
  capitalization: "title" | "sentence" | "all_caps";
  includeEmoji: boolean;
}

interface CodeStyle {
  commentDensity: "minimal" | "moderate" | "heavy";
  preferInlineComments: boolean;
  explanationStyle: "before" | "after" | "inline";
}

interface SampleEdit {
  original: string;
  edited: string;
  postId: string;
}

export interface StyleProfile {
  id: string;
  workspaceId: string;
  formality: number | null;
  technicalDepth: number | null;
  humor: number | null;
  headingStyle: HeadingStyle | null;
  codeStyle: CodeStyle | null;
  vocabularyPatterns: string[] | null;
  sampleEdits: SampleEdit[] | null;
  publishedPostsAnalyzed: number | null;
  generationStatus: string | null;
  lastGeneratedAt: string | null;
}

interface StyleProfileCardProps {
  profile: StyleProfile;
  workspace: string;
  onUpdated?: () => void;
}

// --- Sub-components ---

function ScoreBar({ label, value }: { label: string; value: number | null }) {
  const pct = value != null ? Math.min(100, (value / 10) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-sf-text-secondary">{label}</span>
        <span className="text-sm font-semibold text-sf-text-primary tabular-nums">
          {value != null ? value.toFixed(1) : "—"} / 10
        </span>
      </div>
      <div className="h-2 bg-sf-bg-tertiary rounded-sf-full overflow-hidden border border-sf-border">
        <div
          className="h-full bg-sf-accent rounded-sf-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <span className="px-2.5 py-1 rounded-sf text-xs font-medium bg-sf-accent-bg text-sf-accent border border-sf-accent/30 capitalize">
      {label.replace(/_/g, " ")}
    </span>
  );
}

function ScoreInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-sm text-sf-text-secondary">{label}</label>
        <span className="text-sm font-semibold text-sf-text-primary tabular-nums">
          {value.toFixed(1)} / 10
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={10}
        step={0.5}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-sf-accent cursor-pointer"
      />
    </div>
  );
}

function EditEntry({ edit, index }: { edit: SampleEdit; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-sf-border rounded-sf overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-sf-text-primary hover:bg-sf-bg-hover transition-colors"
      >
        <span className="font-medium">Representative edit #{index + 1}</span>
        {open ? (
          <ChevronUp size={14} className="text-sf-text-secondary shrink-0" />
        ) : (
          <ChevronDown size={14} className="text-sf-text-secondary shrink-0" />
        )}
      </button>
      {open && (
        <div className="grid grid-cols-2 divide-x divide-sf-border border-t border-sf-border">
          <div className="p-3">
            <p className="text-xs font-semibold text-sf-text-secondary mb-2">AI original</p>
            <p className="text-xs text-sf-text-primary leading-relaxed whitespace-pre-wrap break-words">
              {edit.original}
            </p>
          </div>
          <div className="p-3">
            <p className="text-xs font-semibold text-sf-accent mb-2">Your rewrite</p>
            <p className="text-xs text-sf-text-primary leading-relaxed whitespace-pre-wrap break-words">
              {edit.edited}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Main component ---

export function StyleProfileCard({ profile, workspace, onUpdated }: StyleProfileCardProps) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const [formality, setFormality] = useState(profile.formality ?? 5);
  const [technicalDepth, setTechnicalDepth] = useState(profile.technicalDepth ?? 5);
  const [humor, setHumor] = useState(profile.humor ?? 5);
  const [vocabNote, setVocabNote] = useState(profile.vocabularyPatterns?.[0] ?? "");
  const [structureNote, setStructureNote] = useState(profile.vocabularyPatterns?.[1] ?? "");

  const save = useMutation({
    mutationFn: async () => {
      const vocabPatterns = [vocabNote, structureNote].filter((s) => s.trim().length > 0);
      const res = await fetch(`/api/workspace/${workspace}/style-profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formality,
          technicalDepth,
          humor,
          vocabularyPatterns: vocabPatterns,
        }),
      });
      if (!res.ok) throw new Error("Failed to save style profile");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["style-profile", workspace] });
      setEditing(false);
      onUpdated?.();
    },
  });

  const handleCancel = () => {
    setFormality(profile.formality ?? 5);
    setTechnicalDepth(profile.technicalDepth ?? 5);
    setHumor(profile.humor ?? 5);
    setVocabNote(profile.vocabularyPatterns?.[0] ?? "");
    setStructureNote(profile.vocabularyPatterns?.[1] ?? "");
    setEditing(false);
  };

  const headingCap = profile.headingStyle?.capitalization;
  const codeExpl = profile.codeStyle?.explanationStyle;
  const hasStyleChips = headingCap || codeExpl || profile.headingStyle?.includeEmoji;
  const hasVocabNotes =
    profile.vocabularyPatterns && profile.vocabularyPatterns.length > 0;
  const hasSampleEdits = profile.sampleEdits && profile.sampleEdits.length > 0;

  return (
    <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-sf-text-primary">Learned Voice Profile</h2>
          {profile.publishedPostsAnalyzed != null && (
            <p className="text-xs text-sf-text-secondary mt-0.5">
              Analyzed from {profile.publishedPostsAnalyzed} published post
              {profile.publishedPostsAnalyzed !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {editing ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-sf text-sm text-sf-text-secondary border border-sf-border hover:bg-sf-bg-hover transition-colors"
            >
              <X size={14} />
              Cancel
            </button>
            <button
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-sf text-sm bg-sf-accent text-sf-bg-primary font-medium hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
            >
              <Save size={14} />
              {save.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-sf text-sm text-sf-text-secondary border border-sf-border hover:bg-sf-bg-hover transition-colors"
          >
            <Pencil size={14} />
            Edit
          </button>
        )}
      </div>

      {/* Personality scores */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-sf-text-secondary">
          Personality scores
        </h3>
        {editing ? (
          <div className="space-y-4">
            <ScoreInput label="Formality" value={formality} onChange={setFormality} />
            <ScoreInput label="Technical depth" value={technicalDepth} onChange={setTechnicalDepth} />
            <ScoreInput label="Humor" value={humor} onChange={setHumor} />
          </div>
        ) : (
          <div className="space-y-3">
            <ScoreBar label="Formality" value={profile.formality} />
            <ScoreBar label="Technical depth" value={profile.technicalDepth} />
            <ScoreBar label="Humor" value={profile.humor} />
          </div>
        )}
      </div>

      {/* Style signal chips */}
      {hasStyleChips && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-sf-text-secondary">
            Style signals
          </h3>
          <div className="flex flex-wrap gap-2">
            {headingCap && <Chip label={`${headingCap} headings`} />}
            {codeExpl && <Chip label={`${codeExpl} code explanations`} />}
            {profile.headingStyle?.includeEmoji && <Chip label="uses emoji" />}
          </div>
        </div>
      )}

      {/* Voice notes */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-sf-text-secondary">
          Voice notes
        </h3>
        {editing ? (
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-sf-text-secondary mb-1">
                Vocabulary preferences
              </label>
              <textarea
                value={vocabNote}
                onChange={(e) => setVocabNote(e.target.value)}
                rows={3}
                placeholder="Describe vocabulary tendencies…"
                className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary resize-none focus:outline-none focus:border-sf-border-focus"
              />
            </div>
            <div>
              <label className="block text-sm text-sf-text-secondary mb-1">
                Sentence structure patterns
              </label>
              <textarea
                value={structureNote}
                onChange={(e) => setStructureNote(e.target.value)}
                rows={3}
                placeholder="Describe sentence structure tendencies…"
                className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary resize-none focus:outline-none focus:border-sf-border-focus"
              />
            </div>
          </div>
        ) : hasVocabNotes ? (
          <div className="space-y-3">
            {profile.vocabularyPatterns![0] && (
              <div>
                <p className="text-xs font-medium text-sf-text-secondary mb-1">
                  Vocabulary preferences
                </p>
                <p className="text-sm text-sf-text-primary leading-relaxed bg-sf-bg-tertiary rounded-sf px-3 py-2 border border-sf-border">
                  {profile.vocabularyPatterns![0]}
                </p>
              </div>
            )}
            {profile.vocabularyPatterns![1] && (
              <div>
                <p className="text-xs font-medium text-sf-text-secondary mb-1">
                  Sentence structure patterns
                </p>
                <p className="text-sm text-sf-text-primary leading-relaxed bg-sf-bg-tertiary rounded-sf px-3 py-2 border border-sf-border">
                  {profile.vocabularyPatterns![1]}
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-sf-text-secondary italic">No voice notes detected.</p>
        )}
      </div>

      {/* Representative edits */}
      {hasSampleEdits && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-sf-text-secondary">
            Representative edits ({profile.sampleEdits!.length})
          </h3>
          <div className="space-y-2">
            {profile.sampleEdits!.map((edit, i) => (
              <EditEntry key={i} edit={edit} index={i} />
            ))}
          </div>
        </div>
      )}

      {save.isError && (
        <p className="text-sm text-sf-danger">Failed to save. Please try again.</p>
      )}
    </div>
  );
}
