"use client";

import { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Plus, X, Link, GitBranch, FileText, Zap, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

type Phase =
  | "idle"
  | "ingesting"
  | "mining"
  | "assembling"
  | "arc_selection"
  | "writing"
  | "complete"
  | "error";

interface ArcOption {
  id: string;
  name: string;
  description: string;
  icon: string;
}

interface ProgressState {
  phase: Phase;
  message: string;
  urlCount?: number;
  repoCount?: number;
  hasBrief?: boolean;
  crossReferences?: number;
  textChunks: string[];
  error?: string;
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function NewContentPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const router = useRouter();

  const [topic, setTopic] = useState("");
  const [userText, setUserText] = useState("");
  const [urls, setUrls] = useState<string[]>([""]);
  const [repoUrls, setRepoUrls] = useState<string[]>([""]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [arcs, setArcs] = useState<ArcOption[]>([]);
  const [selectedArc, setSelectedArc] = useState<string | null>(null);
  const [arcsLoading, setArcsLoading] = useState(false);
  const [progress, setProgress] = useState<ProgressState>({
    phase: "idle",
    message: "",
    textChunks: [],
  });

  const abortRef = useRef<AbortController | null>(null);

  // ── Fetch arc suggestions when topic changes (debounced) ──

  useEffect(() => {
    if (topic.trim().length < 10) {
      setArcs([]);
      setSelectedArc(null);
      return;
    }
    setArcsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/content/suggest-arcs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: topic.trim() }),
        });
        if (res.ok) {
          const data = await res.json();
          setArcs(data.arcs ?? []);
        }
      } catch {
        // Silently ignore — arcs are optional
      } finally {
        setArcsLoading(false);
      }
    }, 1500);
    return () => {
      clearTimeout(timer);
      setArcsLoading(false);
    };
  }, [topic]);

  // ── URL list helpers ──

  const addUrl = () => setUrls((prev) => [...prev, ""]);
  const removeUrl = (i: number) =>
    setUrls((prev) => prev.filter((_, idx) => idx !== i));
  const setUrl = (i: number, val: string) =>
    setUrls((prev) => prev.map((u, idx) => (idx === i ? val : u)));

  const addRepo = () => setRepoUrls((prev) => [...prev, ""]);
  const removeRepo = (i: number) =>
    setRepoUrls((prev) => prev.filter((_, idx) => idx !== i));
  const setRepo = (i: number, val: string) =>
    setRepoUrls((prev) => prev.map((u, idx) => (idx === i ? val : u)));

  // ── Generation ──

  const handleGenerate = async () => {
    if (!topic.trim()) return;

    const validUrls = urls.filter((u) => u.trim());
    const validRepos = repoUrls.filter((u) => u.trim());

    setIsGenerating(true);
    setProgress({ phase: "ingesting", message: "Starting…", textChunks: [] });

    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/agents/evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceSlug: workspace,
          topic: topic.trim(),
          userText: userText.trim() || undefined,
          urls: validUrls,
          repoUrls: validRepos,
          narrativeArc: selectedArc || undefined,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        const errData = await res.json().catch(() => ({}));
        setProgress((p) => ({
          ...p,
          phase: "error",
          error: (errData as any).error ?? `HTTP ${res.status}`,
        }));
        setIsGenerating(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let postId: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          if (!part.trim()) continue;
          const lines = part.split("\n");
          let event = "message";
          let data = "";

          for (const line of lines) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            if (line.startsWith("data:")) data = line.slice(5).trim();
          }

          if (!data || data === "[DONE]") continue;

          try {
            const payload = JSON.parse(data);

            if (event === "status") {
              setProgress((p) => ({
                ...p,
                phase: (payload.phase as Phase) ?? p.phase,
                message: payload.message ?? p.message,
                urlCount: payload.urlCount ?? p.urlCount,
                repoCount: payload.repoCount ?? p.repoCount,
                hasBrief: payload.hasBrief ?? p.hasBrief,
                crossReferences: payload.crossReferences ?? p.crossReferences,
              }));
            } else if (event === "text") {
              setProgress((p) => ({
                ...p,
                phase: "writing",
                message: "Writing…",
                textChunks: [...p.textChunks, payload.content ?? ""],
              }));
            } else if (event === "tool_result") {
              // Look for create_post result to extract postId
              const result = payload.result;
              if (result && typeof result === "object" && "id" in result) {
                postId = (result as any).id as string;
              }
            } else if (event === "complete") {
              setProgress((p) => ({
                ...p,
                phase: "complete",
                message: "Content generated successfully!",
              }));
            } else if (event === "error") {
              setProgress((p) => ({
                ...p,
                phase: "error",
                error: payload.message ?? "An error occurred",
              }));
            }
          } catch {
            // Ignore parse errors
          }
        }
      }

      // Redirect to editor if we got a postId
      if (postId) {
        router.push(`/${workspace}/content/${postId}`);
      } else {
        setIsGenerating(false);
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setProgress((p) => ({
          ...p,
          phase: "idle",
          message: "Generation cancelled",
        }));
      } else {
        setProgress((p) => ({
          ...p,
          phase: "error",
          error: err instanceof Error ? err.message : "Generation failed",
        }));
      }
      setIsGenerating(false);
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    setIsGenerating(false);
  };

  // ── Phase label ──

  const phaseLabel: Record<Phase, string> = {
    idle: "",
    ingesting: "Processing sources",
    mining: "Mining session evidence",
    assembling: "Assembling research",
    arc_selection: "Assembling research",
    writing: "Writing content",
    complete: "Complete",
    error: "Error",
  };

  const phaseStep: Record<Phase, number> = {
    idle: 0,
    ingesting: 1,
    mining: 2,
    assembling: 3,
    arc_selection: 3,
    writing: 4,
    complete: 5,
    error: 0,
  };

  const currentStep = phaseStep[progress.phase];

  // ── Render ──

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="text-sf-text-muted hover:text-sf-text-secondary transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold font-display">New Content</h1>
          <p className="text-xs text-sf-text-muted mt-0.5">
            Generate evidence-based content from your sessions and sources
          </p>
        </div>
      </div>

      {!isGenerating ? (
        <div className="space-y-6">
          {/* Topic */}
          <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4">
            <label className="block text-sm font-semibold text-sf-text-primary mb-2">
              Topic <span className="text-sf-accent">*</span>
            </label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="What do you want to write about? Be specific — this drives the evidence search."
              rows={3}
              className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary placeholder:text-sf-text-muted focus:border-sf-border-focus focus:outline-none resize-none"
            />
          </div>

          {/* User perspective */}
          <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4">
            <label className="block text-sm font-semibold text-sf-text-primary mb-1">
              <FileText size={14} className="inline mr-1.5 opacity-70" />
              Your Perspective
              <span className="text-sf-text-muted font-normal ml-1">(optional)</span>
            </label>
            <p className="text-xs text-sf-text-muted mb-2">
              Share your thesis, key points, or context. Claude will use this as the starting framework.
            </p>
            <textarea
              value={userText}
              onChange={(e) => setUserText(e.target.value)}
              placeholder="e.g. I've been using drizzle-orm for 6 months and found that the type inference breaks down in certain edge cases..."
              rows={4}
              className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary placeholder:text-sf-text-muted focus:border-sf-border-focus focus:outline-none resize-none"
            />
          </div>

          {/* URLs */}
          <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4">
            <label className="block text-sm font-semibold text-sf-text-primary mb-1">
              <Link size={14} className="inline mr-1.5 opacity-70" />
              External URLs
              <span className="text-sf-text-muted font-normal ml-1">(optional, up to 10)</span>
            </label>
            <p className="text-xs text-sf-text-muted mb-3">
              Articles, docs, or blog posts to reference. Claude will extract and cite their content.
            </p>
            <div className="space-y-2">
              {urls.map((url, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(i, e.target.value)}
                    placeholder="https://..."
                    className="flex-1 bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary placeholder:text-sf-text-muted focus:border-sf-border-focus focus:outline-none"
                  />
                  {urls.length > 1 && (
                    <button
                      onClick={() => removeUrl(i)}
                      className="text-sf-text-muted hover:text-red-400 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {urls.length < 10 && (
              <button
                onClick={addUrl}
                className="mt-2 flex items-center gap-1 text-xs text-sf-accent hover:text-sf-accent-dim transition-colors"
              >
                <Plus size={14} />
                Add URL
              </button>
            )}
          </div>

          {/* Repo URLs */}
          <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4">
            <label className="block text-sm font-semibold text-sf-text-primary mb-1">
              <GitBranch size={14} className="inline mr-1.5 opacity-70" />
              GitHub Repositories
              <span className="text-sf-text-muted font-normal ml-1">(optional, up to 5)</span>
            </label>
            <p className="text-xs text-sf-text-muted mb-3">
              Public repos to analyze for patterns, tech stack, and code examples.
            </p>
            <div className="space-y-2">
              {repoUrls.map((url, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setRepo(i, e.target.value)}
                    placeholder="https://github.com/..."
                    className="flex-1 bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary placeholder:text-sf-text-muted focus:border-sf-border-focus focus:outline-none"
                  />
                  {repoUrls.length > 1 && (
                    <button
                      onClick={() => removeRepo(i)}
                      className="text-sf-text-muted hover:text-red-400 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {repoUrls.length < 5 && (
              <button
                onClick={addRepo}
                className="mt-2 flex items-center gap-1 text-xs text-sf-accent hover:text-sf-accent-dim transition-colors"
              >
                <Plus size={14} />
                Add Repository
              </button>
            )}
          </div>

          {/* Narrative Arc selection */}
          {(arcs.length > 0 || arcsLoading) && (
            <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4">
              <label className="block text-sm font-semibold text-sf-text-primary mb-1">
                Narrative Arc
                <span className="text-sf-text-muted font-normal ml-1">(optional)</span>
              </label>
              <p className="text-xs text-sf-text-muted mb-3">
                Choose how to structure your content, or let Claude decide.
              </p>
              {arcsLoading ? (
                <div className="flex items-center gap-2 text-xs text-sf-text-muted py-2">
                  <div className="w-3 h-3 border-2 border-sf-accent border-t-transparent rounded-full animate-spin" />
                  Analyzing topic for arc suggestions...
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {arcs.map((arc) => (
                    <button
                      key={arc.id}
                      type="button"
                      onClick={() =>
                        setSelectedArc(selectedArc === arc.id ? null : arc.id)
                      }
                      className={cn(
                        "text-left p-3 rounded-sf border transition-colors",
                        selectedArc === arc.id
                          ? "border-sf-accent bg-sf-accent/10"
                          : "border-sf-border bg-sf-bg-tertiary hover:border-sf-border-focus"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span>{arc.icon}</span>
                        <span className="text-sm font-medium text-sf-text-primary">
                          {arc.name}
                        </span>
                      </div>
                      <p className="text-xs text-sf-text-secondary">
                        {arc.description}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={!topic.trim()}
            className="w-full flex items-center justify-center gap-2 bg-sf-accent text-sf-bg-primary px-6 py-3 rounded-sf font-semibold text-sm hover:bg-sf-accent-dim transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Zap size={16} />
            Generate Evidence-Based Content
          </button>

          {progress.phase === "error" && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-sf px-4 py-3 text-sm text-red-400">
              {progress.error}
            </div>
          )}
        </div>
      ) : (
        /* Progress view */
        <div className="space-y-6">
          {/* Pipeline steps */}
          <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-sf-text-primary">Generating Content</h2>
              <button
                onClick={handleCancel}
                className="text-xs text-sf-text-muted hover:text-sf-text-secondary transition-colors"
              >
                Cancel
              </button>
            </div>

            {/* Step indicators */}
            <div className="space-y-3">
              {(
                [
                  { step: 1, label: "Processing sources", phase: "ingesting" },
                  { step: 2, label: "Mining session evidence", phase: "mining" },
                  { step: 3, label: "Assembling research", phase: "assembling" },
                  { step: 4, label: "Writing content", phase: "writing" },
                ] as const
              ).map(({ step, label, phase }) => {
                const isDone = currentStep > step;
                const isActive = currentStep === step;
                return (
                  <div key={step} className="flex items-center gap-3">
                    <div
                      className={[
                        "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                        isDone
                          ? "bg-sf-accent text-sf-bg-primary"
                          : isActive
                          ? "bg-sf-accent/20 border border-sf-accent text-sf-accent"
                          : "bg-sf-bg-tertiary border border-sf-border text-sf-text-muted",
                      ].join(" ")}
                    >
                      {isDone ? "✓" : step}
                    </div>
                    <div className="flex-1">
                      <div
                        className={[
                          "text-sm font-medium",
                          isDone
                            ? "text-sf-text-primary"
                            : isActive
                            ? "text-sf-accent"
                            : "text-sf-text-muted",
                        ].join(" ")}
                      >
                        {label}
                      </div>
                      {isActive && progress.message && (
                        <div className="text-xs text-sf-text-secondary mt-0.5">
                          {progress.message}
                        </div>
                      )}
                      {isActive && phase === "assembling" && (
                        <div className="flex items-center gap-3 mt-1 text-xs text-sf-text-muted">
                          {progress.urlCount !== undefined && (
                            <span>{progress.urlCount} URL{progress.urlCount !== 1 ? "s" : ""}</span>
                          )}
                          {progress.repoCount !== undefined && (
                            <span>{progress.repoCount} repo{progress.repoCount !== 1 ? "s" : ""}</span>
                          )}
                          {progress.hasBrief && <span>+ brief</span>}
                        </div>
                      )}
                    </div>
                    {isActive && (
                      <div className="w-4 h-4 border-2 border-sf-accent border-t-transparent rounded-full animate-spin" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live text preview */}
          {progress.textChunks.length > 0 && (
            <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4">
              <h3 className="text-xs font-semibold text-sf-text-muted uppercase tracking-wide mb-3">
                Preview
              </h3>
              <div className="text-sm text-sf-text-secondary leading-relaxed max-h-64 overflow-y-auto font-mono whitespace-pre-wrap">
                {progress.textChunks.join("")}
              </div>
            </div>
          )}

          {progress.phase === "complete" && (
            <div className="bg-sf-accent/10 border border-sf-accent/30 rounded-sf px-4 py-3 text-sm text-sf-accent text-center">
              Content generated — redirecting to editor…
            </div>
          )}

          {progress.phase === "error" && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-sf px-4 py-3 text-sm text-red-400">
              {progress.error}
              <button
                onClick={() => {
                  setIsGenerating(false);
                  setProgress({ phase: "idle", message: "", textChunks: [] });
                }}
                className="ml-3 underline hover:no-underline"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
