"use client";

import { useState } from "react";
import { OnboardingTooltip } from "@/components/onboarding/onboarding-tooltip";

type StepWorkspaceProps = {
  onNext: (data: { name: string }) => void;
  initialName?: string;
};

export function StepWorkspace({ onNext, initialName = "" }: StepWorkspaceProps) {
  const [name, setName] = useState(initialName);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onNext({ name: name.trim() });
  }

  return (
    <div className="w-full max-w-lg bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-8">
      <p className="text-sf-text-muted text-xs font-medium uppercase tracking-widest mb-6">
        Step 1 of 5
      </p>

      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-xl font-bold text-sf-text-primary">
          Name your workspace
        </h2>
        <OnboardingTooltip content="A workspace organises all your sessions, insights, and generated content in one place. Think of it as a project space — you can rename it any time from settings." />
      </div>
      <p className="text-sf-text-secondary text-sm mb-6">
        Your workspace is where your sessions, insights, and content live. You
        can always change this later.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm text-sf-text-secondary mb-1">
            Workspace name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sf-text-primary placeholder:text-sf-text-muted focus:border-sf-border-focus focus:outline-none"
            placeholder="e.g. My Projects"
            autoFocus
          />
        </div>

        <button
          type="submit"
          disabled={!name.trim()}
          className="w-full bg-sf-accent text-sf-bg-primary font-medium py-2 rounded-sf hover:bg-sf-accent-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </form>
    </div>
  );
}
