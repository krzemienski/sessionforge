"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Palette } from "lucide-react";

const TONE_OPTIONS = ["technical", "tutorial", "conversational"] as const;

interface StyleTabProps {
  workspace: string;
}

export function StyleTab({ workspace }: StyleTabProps) {
  const qc = useQueryClient();

  const style = useQuery({
    queryKey: ["style", workspace],
    queryFn: async () => {
      const res = await fetch(`/api/workspace/${workspace}/style`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const [tone, setTone] = useState("technical");
  const [audience, setAudience] = useState("senior engineers");
  const [instructions, setInstructions] = useState("");
  const [includeCode, setIncludeCode] = useState(true);
  const [includeTerminal, setIncludeTerminal] = useState(true);
  const [maxWords, setMaxWords] = useState(2500);

  useEffect(() => {
    if (style.data) {
      setTone(style.data.defaultTone || "technical");
      setAudience(style.data.targetAudience || "senior engineers");
      setInstructions(style.data.customInstructions || "");
      setIncludeCode(style.data.includeCodeSnippets ?? true);
      setIncludeTerminal(style.data.includeTerminalOutput ?? true);
      setMaxWords(style.data.maxBlogWordCount || 2500);
    }
  }, [style.data]);

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/workspace/${workspace}/style`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultTone: tone,
          targetAudience: audience,
          customInstructions: instructions || null,
          includeCodeSnippets: includeCode,
          includeTerminalOutput: includeTerminal,
          maxBlogWordCount: maxWords,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["style", workspace] }),
  });

  if (style.isLoading) {
    return <div className="animate-pulse space-y-4"><div className="h-8 bg-sf-bg-tertiary rounded w-1/3" /></div>;
  }

  return (
    <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6 space-y-5">
      <div className="flex items-center gap-2 mb-1">
        <Palette size={18} className="text-sf-accent" />
        <h2 className="text-base font-semibold font-display">Writing Style</h2>
      </div>

      <div>
        <label className="block text-sm font-medium text-sf-text-secondary mb-1">Default Tone</label>
        <select value={tone} onChange={(e) => setTone(e.target.value)} className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus">
          {TONE_OPTIONS.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-sf-text-secondary mb-1">Target Audience</label>
        <input value={audience} onChange={(e) => setAudience(e.target.value)} className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus" />
      </div>

      <div>
        <label className="block text-sm font-medium text-sf-text-secondary mb-1">Custom Instructions</label>
        <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={4} placeholder="Additional instructions for content generation..." className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary resize-none focus:outline-none focus:border-sf-border-focus" />
      </div>

      <div>
        <label className="block text-sm font-medium text-sf-text-secondary mb-1">Max Blog Word Count</label>
        <input type="number" value={maxWords} onChange={(e) => setMaxWords(parseInt(e.target.value) || 2500)} min={500} max={10000} step={100} className="w-32 bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus" />
      </div>

      <div className="space-y-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={includeCode} onChange={(e) => setIncludeCode(e.target.checked)} className="rounded border-sf-border bg-sf-bg-tertiary text-sf-accent focus:ring-sf-accent" />
          <span className="text-sm text-sf-text-primary">Include code snippets in generated content</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={includeTerminal} onChange={(e) => setIncludeTerminal(e.target.checked)} className="rounded border-sf-border bg-sf-bg-tertiary text-sf-accent focus:ring-sf-accent" />
          <span className="text-sm text-sf-text-primary">Include terminal output in generated content</span>
        </label>
      </div>

      <button onClick={() => save.mutate()} disabled={save.isPending} className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors disabled:opacity-50">
        <Save size={16} />
        {save.isPending ? "Saving..." : "Save Style"}
      </button>
      {save.isSuccess && <p className="text-sm text-sf-success">Style settings saved.</p>}
      {save.isError && <p className="text-sm text-sf-error">Failed to save style settings.</p>}
    </div>
  );
}
