"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Save } from "lucide-react";

const TONE_OPTIONS = ["technical", "casual", "professional", "storytelling", "educational"];
const AUDIENCE_OPTIONS = ["developers", "engineering_managers", "startup_founders", "general_tech", "beginners"];

export default function StyleSettingsPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const qc = useQueryClient();

  const style = useQuery({
    queryKey: ["style-settings", workspace],
    queryFn: async () => {
      const res = await fetch(`/api/workspace/${workspace}/style`);
      if (!res.ok && res.status !== 404) throw new Error("Failed");
      if (res.status === 404) return null;
      return res.json();
    },
  });

  const [tone, setTone] = useState("technical");
  const [audience, setAudience] = useState("developers");
  const [codeStyle, setCodeStyle] = useState("annotated");
  const [customInstructions, setCustomInstructions] = useState("");
  const [includeMetrics, setIncludeMetrics] = useState(true);

  useEffect(() => {
    if (style.data) {
      setTone(style.data.defaultTone || "technical");
      setAudience(style.data.targetAudience || "developers");
      setCodeStyle(style.data.codeBlockStyle || "annotated");
      setCustomInstructions(style.data.customInstructions || "");
      setIncludeMetrics(style.data.includeMetrics ?? true);
    }
  }, [style.data]);

  const save = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch(`/api/workspace/${workspace}/style`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["style-settings"] }),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-display">Writing Style</h1>
      </div>

      <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-sf-text-secondary mb-2">Default Tone</label>
          <div className="flex flex-wrap gap-2">
            {TONE_OPTIONS.map((t) => (
              <button
                key={t}
                onClick={() => setTone(t)}
                className={`px-3 py-1.5 rounded-sf text-sm capitalize transition-colors ${
                  tone === t
                    ? "bg-sf-accent-bg text-sf-accent border border-sf-accent/30"
                    : "bg-sf-bg-tertiary text-sf-text-secondary border border-sf-border hover:bg-sf-bg-hover"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-sf-text-secondary mb-2">Target Audience</label>
          <div className="flex flex-wrap gap-2">
            {AUDIENCE_OPTIONS.map((a) => (
              <button
                key={a}
                onClick={() => setAudience(a)}
                className={`px-3 py-1.5 rounded-sf text-sm capitalize transition-colors ${
                  audience === a
                    ? "bg-sf-accent-bg text-sf-accent border border-sf-accent/30"
                    : "bg-sf-bg-tertiary text-sf-text-secondary border border-sf-border hover:bg-sf-bg-hover"
                }`}
              >
                {a.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-sf-text-secondary mb-2">Code Block Style</label>
          <div className="flex gap-2">
            {["annotated", "minimal", "full_context"].map((s) => (
              <button
                key={s}
                onClick={() => setCodeStyle(s)}
                className={`px-3 py-1.5 rounded-sf text-sm capitalize transition-colors ${
                  codeStyle === s
                    ? "bg-sf-accent-bg text-sf-accent border border-sf-accent/30"
                    : "bg-sf-bg-tertiary text-sf-text-secondary border border-sf-border hover:bg-sf-bg-hover"
                }`}
              >
                {s.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIncludeMetrics(!includeMetrics)}
            className={`w-10 h-5 rounded-full transition-colors relative ${
              includeMetrics ? "bg-sf-accent" : "bg-sf-bg-tertiary border border-sf-border"
            }`}
          >
            <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${includeMetrics ? "translate-x-5" : "translate-x-0.5"}`} />
          </button>
          <span className="text-sm text-sf-text-primary">Include performance metrics in posts</span>
        </div>

        <div>
          <label className="block text-sm font-medium text-sf-text-secondary mb-1">Custom Instructions</label>
          <textarea
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            rows={4}
            placeholder="Additional instructions for content generation agents..."
            className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary resize-none focus:outline-none focus:border-sf-border-focus"
          />
        </div>

        <button
          onClick={() =>
            save.mutate({
              defaultTone: tone,
              targetAudience: audience,
              codeBlockStyle: codeStyle,
              customInstructions,
              includeMetrics,
            })
          }
          disabled={save.isPending}
          className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
        >
          <Save size={16} />
          {save.isPending ? "Saving..." : "Save Style"}
        </button>

        {save.isSuccess && <p className="text-sm text-sf-success">Style settings saved.</p>}
      </div>
    </div>
  );
}
