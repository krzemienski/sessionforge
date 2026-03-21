"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, SlidersHorizontal } from "lucide-react";

interface VoiceParametersPanelProps {
  workspace: string;
}

interface SliderFieldProps {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step: number;
  lowLabel: string;
  highLabel: string;
  onChange: (value: number) => void;
}

function SliderField({
  label,
  description,
  value,
  min,
  max,
  step,
  lowLabel,
  highLabel,
  onChange,
}: SliderFieldProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-sm font-medium text-sf-text-primary">{label}</label>
          <p className="text-xs text-sf-text-secondary mt-0.5">{description}</p>
        </div>
        <span className="text-sm font-semibold text-sf-accent tabular-nums w-8 text-right">
          {value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-1.5 bg-sf-bg-tertiary rounded-full appearance-none cursor-pointer accent-sf-accent"
      />
      <div className="flex justify-between text-xs text-sf-text-secondary">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}

export function VoiceParametersPanel({ workspace }: VoiceParametersPanelProps) {
  const qc = useQueryClient();

  const profile = useQuery({
    queryKey: ["style-profile", workspace],
    queryFn: async () => {
      const res = await fetch(`/api/workspace/${workspace}/style-profile`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to load style profile");
      return res.json();
    },
  });

  const [formality, setFormality] = useState(5);
  const [humor, setHumor] = useState(5);
  const [technicalDepth, setTechnicalDepth] = useState(5);

  useEffect(() => {
    if (profile.data) {
      setFormality(profile.data.formality ?? 5);
      setHumor(profile.data.humor ?? 5);
      setTechnicalDepth(profile.data.technicalDepth ?? 5);
    }
  }, [profile.data]);

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/workspace/${workspace}/style-profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formality, humor, technicalDepth }),
      });
      if (!res.ok) throw new Error("Failed to save voice parameters");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["style-profile", workspace] }),
  });

  if (profile.isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-sf-bg-tertiary rounded w-1/3" />
        <div className="h-4 bg-sf-bg-tertiary rounded w-full" />
        <div className="h-4 bg-sf-bg-tertiary rounded w-full" />
        <div className="h-4 bg-sf-bg-tertiary rounded w-full" />
      </div>
    );
  }

  return (
    <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6 space-y-5">
      <div className="flex items-center gap-2 mb-1">
        <SlidersHorizontal size={18} className="text-sf-accent" />
        <h2 className="text-base font-semibold font-display">Voice Parameters</h2>
      </div>
      <p className="text-sm text-sf-text-secondary -mt-2">
        Fine-tune how your voice sounds in generated content. Changes apply to all future content generation.
      </p>

      <div className="space-y-6">
        <SliderField
          label="Formality"
          description="How formal or casual your writing tone should be"
          value={formality}
          min={1}
          max={10}
          step={1}
          lowLabel="Casual"
          highLabel="Formal"
          onChange={setFormality}
        />

        <SliderField
          label="Humor"
          description="How much wit and levity to weave into the writing"
          value={humor}
          min={1}
          max={10}
          step={1}
          lowLabel="Serious"
          highLabel="Playful"
          onChange={setHumor}
        />

        <SliderField
          label="Technical Depth"
          description="How deep to go into technical implementation details"
          value={technicalDepth}
          min={1}
          max={10}
          step={1}
          lowLabel="High-level"
          highLabel="Deep dive"
          onChange={setTechnicalDepth}
        />
      </div>

      <button
        onClick={() => save.mutate()}
        disabled={save.isPending}
        className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
      >
        <Save size={16} />
        {save.isPending ? "Saving..." : "Save Parameters"}
      </button>
      {save.isSuccess && <p className="text-sm text-sf-success">Voice parameters saved.</p>}
      {save.isError && <p className="text-sm text-sf-error">Failed to save voice parameters.</p>}
    </div>
  );
}
