"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Brain, Plus, Trash2, Pencil, Download, X, Check } from "lucide-react";
import { BUILT_IN_SKILLS } from "@/lib/ai/skills/built-in-skills";

type Skill = {
  id: string;
  name: string;
  description: string | null;
  instructions: string;
  appliesTo: string[] | null;
  enabled: boolean;
  source: string;
  filePath: string | null;
  createdAt: string | null;
};

const APPLIES_TO_OPTIONS = ["blog", "social", "changelog"];

const SOURCE_BADGE: Record<string, string> = {
  builtin: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  custom: "bg-green-500/15 text-green-400 border-green-500/25",
  imported: "bg-amber-500/15 text-amber-400 border-amber-500/25",
};

export default function SkillsPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const qc = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formInstructions, setFormInstructions] = useState("");
  const [formAppliesTo, setFormAppliesTo] = useState<string[]>([]);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const skills = useQuery({
    queryKey: ["skills", workspace],
    queryFn: async () => {
      const res = await fetch(`/api/skills?workspace=${workspace}`);
      if (!res.ok) throw new Error("Failed to load skills");
      return res.json() as Promise<{ skills: Skill[] }>;
    },
  });

  const seedBuiltIns = useMutation({
    mutationFn: async () => {
      await Promise.all(
        BUILT_IN_SKILLS.map((s) =>
          fetch("/api/skills", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              workspaceSlug: workspace,
              name: s.name,
              description: s.description,
              instructions: s.instructions,
              appliesTo: s.appliesTo,
              source: s.source,
            }),
          })
        )
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["skills", workspace] }),
  });

  useEffect(() => {
    if (skills.data && skills.data.skills.length === 0 && !seedBuiltIns.isPending) {
      seedBuiltIns.mutate();
    }
  }, [skills.data]);

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceSlug: workspace,
          name: formName,
          description: formDescription || null,
          instructions: formInstructions,
          appliesTo: formAppliesTo.length > 0 ? formAppliesTo : null,
          source: "custom",
        }),
      });
      if (!res.ok) throw new Error("Failed to create skill");
      return res.json();
    },
    onSuccess: () => {
      resetForm();
      qc.invalidateQueries({ queryKey: ["skills", workspace] });
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Skill> }) => {
      const res = await fetch(`/api/skills/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update skill");
      return res.json();
    },
    onSuccess: () => {
      resetForm();
      qc.invalidateQueries({ queryKey: ["skills", workspace] });
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/skills/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["skills", workspace] }),
  });

  const importSkills = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/skills/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceSlug: workspace }),
      });
      if (!res.ok) throw new Error("Import failed");
      return res.json() as Promise<{ imported: number }>;
    },
    onSuccess: (data) => {
      setImportStatus(
        data.imported > 0
          ? `Imported ${data.imported} skill${data.imported === 1 ? "" : "s"}`
          : "No skills found in ~/.claude/skills/"
      );
      qc.invalidateQueries({ queryKey: ["skills", workspace] });
      setTimeout(() => setImportStatus(null), 4000);
    },
  });

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setFormName("");
    setFormDescription("");
    setFormInstructions("");
    setFormAppliesTo([]);
  }

  function startEdit(skill: Skill) {
    setEditingId(skill.id);
    setFormName(skill.name);
    setFormDescription(skill.description ?? "");
    setFormInstructions(skill.instructions);
    setFormAppliesTo(skill.appliesTo ?? []);
    setShowForm(true);
  }

  function toggleAppliesTo(value: string) {
    setFormAppliesTo((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  function handleSubmit() {
    if (!formName.trim() || !formInstructions.trim()) return;
    if (editingId) {
      update.mutate({
        id: editingId,
        data: {
          name: formName,
          description: formDescription || null,
          instructions: formInstructions,
          appliesTo: formAppliesTo.length > 0 ? formAppliesTo : null,
        },
      });
    } else {
      create.mutate();
    }
  }

  const skillList = skills.data?.skills ?? [];
  const isPending = create.isPending || update.isPending;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-display">Writing Skills</h1>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors"
        >
          <Plus size={16} /> New Skill
        </button>
      </div>

      {/* Import banner */}
      <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4 mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-sf-text-primary">Import from filesystem</p>
          <p className="text-xs text-sf-text-muted mt-0.5">
            Scan <code className="font-code text-sf-accent">~/.claude/skills/</code> and import found skills
          </p>
        </div>
        <div className="flex items-center gap-3">
          {importStatus && (
            <span className="text-xs text-sf-text-secondary">{importStatus}</span>
          )}
          <button
            onClick={() => importSkills.mutate()}
            disabled={importSkills.isPending}
            className="flex items-center gap-2 bg-sf-bg-tertiary border border-sf-border text-sf-text-primary px-3 py-2 rounded-sf text-sm hover:bg-sf-bg-hover transition-colors disabled:opacity-50"
          >
            <Download size={14} />
            {importSkills.isPending ? "Importing..." : "Import"}
          </button>
        </div>
      </div>

      {/* New / Edit form */}
      {showForm && (
        <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-5 mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-sf-text-primary">
              {editingId ? "Edit Skill" : "New Skill"}
            </h2>
            <button onClick={resetForm} className="text-sf-text-muted hover:text-sf-text-primary">
              <X size={16} />
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-sf-text-secondary mb-1">Name</label>
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Always use bullet points"
              className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-sf-text-secondary mb-1">Description</label>
            <input
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Short summary (optional)"
              className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-sf-text-secondary mb-1">Prompt Instructions</label>
            <textarea
              value={formInstructions}
              onChange={(e) => setFormInstructions(e.target.value)}
              rows={4}
              placeholder="Instruction text injected into agent system prompts..."
              className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary resize-none focus:outline-none focus:border-sf-border-focus"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-sf-text-secondary mb-2">Applies To</label>
            <div className="flex gap-2">
              {APPLIES_TO_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => toggleAppliesTo(opt)}
                  className={`px-3 py-1.5 rounded-sf text-xs capitalize transition-colors border ${
                    formAppliesTo.includes(opt)
                      ? "bg-sf-accent-bg text-sf-accent border-sf-accent/30"
                      : "bg-sf-bg-tertiary text-sf-text-secondary border-sf-border hover:bg-sf-bg-hover"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
            <p className="text-xs text-sf-text-muted mt-1">Leave empty to apply to all content types</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={isPending || !formName.trim() || !formInstructions.trim()}
              className="bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf text-sm font-medium disabled:opacity-50 hover:bg-sf-accent-dim transition-colors"
            >
              {isPending ? "Saving..." : editingId ? "Update Skill" : "Create Skill"}
            </button>
            <button onClick={resetForm} className="text-sf-text-secondary px-4 py-2 text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Skills list */}
      <div className="space-y-3">
        {skillList.map((skill) => (
          <div
            key={skill.id}
            className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-sf-text-primary text-sm">{skill.name}</h3>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded border font-medium uppercase tracking-wide ${
                      SOURCE_BADGE[skill.source] ?? SOURCE_BADGE.custom
                    }`}
                  >
                    {skill.source}
                  </span>
                  {skill.appliesTo && skill.appliesTo.length > 0 && (
                    <div className="flex gap-1">
                      {skill.appliesTo.map((a) => (
                        <span
                          key={a}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-sf-bg-tertiary text-sf-text-muted border border-sf-border capitalize"
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {skill.description && (
                  <p className="text-xs text-sf-text-secondary mt-1">{skill.description}</p>
                )}
                <p className="text-xs text-sf-text-muted mt-2 font-code line-clamp-2">
                  {skill.instructions}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Enabled toggle */}
                <button
                  onClick={() => update.mutate({ id: skill.id, data: { enabled: !skill.enabled } })}
                  className={`w-9 h-5 rounded-full transition-colors relative ${
                    skill.enabled ? "bg-sf-accent" : "bg-sf-bg-tertiary border border-sf-border"
                  }`}
                  title={skill.enabled ? "Disable" : "Enable"}
                >
                  <div
                    className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${
                      skill.enabled ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </button>

                {skill.source !== "builtin" && (
                  <>
                    <button
                      onClick={() => startEdit(skill)}
                      className="text-sf-text-muted hover:text-sf-text-primary transition-colors p-1"
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => del.mutate(skill.id)}
                      className="text-sf-text-muted hover:text-sf-danger transition-colors p-1"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}

        {skillList.length === 0 && !skills.isLoading && !seedBuiltIns.isPending && (
          <div className="text-center py-12">
            <Brain size={40} className="mx-auto text-sf-text-muted mb-3" />
            <p className="text-sf-text-secondary">No writing skills yet.</p>
          </div>
        )}

        {(skills.isLoading || seedBuiltIns.isPending) && (
          <div className="text-center py-12">
            <p className="text-sm text-sf-text-muted">Loading skills...</p>
          </div>
        )}
      </div>
    </div>
  );
}
