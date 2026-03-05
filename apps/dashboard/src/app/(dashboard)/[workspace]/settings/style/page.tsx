"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Save, Loader2, Sparkles, AlertCircle } from "lucide-react";
import { StyleProfileCard, type StyleProfile } from "@/components/style/style-profile-card";

const TONE_OPTIONS = ["technical", "casual", "professional", "storytelling", "educational"];
const AUDIENCE_OPTIONS = ["developers", "engineering_managers", "startup_founders", "general_tech", "beginners"];

interface StyleProfileResponse {
  // Fields present when generationStatus === "completed" (full profile)
  generationStatus?: "pending" | "generating" | "completed" | "failed";
  // Status indicator for non-completed or no-profile states
  status?: "insufficient_data" | "pending" | "generating" | "failed";
  publishedCount?: number;
  // Optional improvement trend data
  editDistanceStats?: Array<{ value: number; label: string }>;
}

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

  const styleProfile = useQuery<StyleProfileResponse>({
    queryKey: ["style-profile", workspace],
    queryFn: async () => {
      const res = await fetch(`/api/workspace/${workspace}/style-profile`);
      if (!res.ok) throw new Error("Failed to fetch style profile");
      return res.json();
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === "generating" || data?.generationStatus === "generating") {
        return 3000;
      }
      return false;
    },
  });

  const generateProfile = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/workspace/${workspace}/style-profile/generate`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to start generation");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["style-profile", workspace] }),
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

  const profileData = styleProfile.data;
  const isProfileReady = profileData?.generationStatus === "completed";
  const isGenerating =
    profileData?.status === "generating" || profileData?.generationStatus === "generating";
  const isInsufficient =
    profileData?.status === "insufficient_data" && (profileData?.publishedCount ?? 0) < 5;
  const canGenerate =
    !isProfileReady &&
    !isGenerating &&
    (profileData?.status === "insufficient_data"
      ? (profileData?.publishedCount ?? 0) >= 5
      : profileData?.status === "pending" || profileData?.status === "failed");
  const publishedCount = profileData?.publishedCount ?? 0;
  const editDistanceStats = profileData?.editDistanceStats;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-display">Writing Style</h1>
      </div>

      {/* Learned Voice Profile Section */}
      <div className="mb-6">
        <h2 className="text-base font-semibold text-sf-text-primary mb-3">Learned Voice Profile</h2>

        {styleProfile.isLoading ? (
          <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6 flex items-center gap-3 text-sf-text-secondary">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Loading profile…</span>
          </div>
        ) : styleProfile.isError ? (
          <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6 flex items-center gap-3 text-sf-danger">
            <AlertCircle size={16} />
            <span className="text-sm">Failed to load voice profile.</span>
          </div>
        ) : isProfileReady ? (
          <>
            <StyleProfileCard
              profile={profileData as unknown as StyleProfile}
              workspace={workspace}
              onUpdated={() => qc.invalidateQueries({ queryKey: ["style-profile", workspace] })}
            />
            {editDistanceStats && editDistanceStats.length > 0 && (
              <div className="mt-4 bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-sf-text-secondary mb-3">
                  Edit Distance Improvement
                </h3>
                <div className="flex items-end gap-1.5 h-16">
                  {editDistanceStats.map((stat, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full bg-sf-accent rounded-sf-sm transition-all"
                        style={{ height: `${Math.max(4, Math.min(100, stat.value))}%` }}
                      />
                      <span className="text-xs text-sf-text-secondary truncate w-full text-center">
                        {stat.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : isGenerating ? (
          <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6 flex items-center gap-3">
            <Loader2 size={16} className="animate-spin text-sf-accent" />
            <span className="text-sm text-sf-text-secondary">Analyzing your writing style…</span>
          </div>
        ) : isInsufficient ? (
          <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6">
            <p className="text-sm text-sf-text-secondary mb-4">
              {publishedCount}/5 posts published — publish more to enable voice learning
            </p>
            <button
              disabled
              className="flex items-center gap-2 bg-sf-bg-tertiary text-sf-text-secondary px-4 py-2 rounded-sf font-medium text-sm border border-sf-border opacity-50 cursor-not-allowed"
            >
              <Sparkles size={16} />
              Generate Profile
            </button>
          </div>
        ) : canGenerate ? (
          <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6">
            <p className="text-sm text-sf-text-secondary mb-4">
              {profileData?.status === "failed"
                ? "Profile generation failed. You can try again."
                : `You have ${publishedCount} published post${publishedCount !== 1 ? "s" : ""}. Generate your writing style profile to personalize AI-generated content.`}
            </p>
            <button
              onClick={() => generateProfile.mutate()}
              disabled={generateProfile.isPending}
              className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
            >
              {generateProfile.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Sparkles size={16} />
              )}
              {generateProfile.isPending ? "Starting…" : "Generate Profile"}
            </button>
            {generateProfile.isError && (
              <p className="text-sm text-sf-danger mt-2">Failed to start generation. Please try again.</p>
            )}
          </div>
        ) : null}
      </div>

      {/* Manual Style Settings */}
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
