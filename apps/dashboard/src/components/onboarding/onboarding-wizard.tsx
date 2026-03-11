"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { WelcomeModal } from "./welcome-modal";
import { StepWorkspace } from "./steps/step-workspace";
import { StepScanPath } from "./steps/step-scan-path";
import { StepFirstScan } from "./steps/step-first-scan";
import { StepInsights } from "./steps/step-insights";
import { useCompleteOnboarding } from "@/hooks/use-onboarding";
import { OnboardingProgressBar } from "./onboarding-progress-bar";

type Step = "welcome" | "workspace" | "scan-path" | "first-scan" | "insights";

const STEP_ORDER: Step[] = ["workspace", "scan-path", "first-scan", "insights"];
const TOTAL_STEPS = STEP_ORDER.length;

type OnboardingWizardProps = {
  initialWorkspaceName?: string;
};

export function OnboardingWizard({ initialWorkspaceName }: OnboardingWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [workspaceName, setWorkspaceName] = useState(initialWorkspaceName ?? "");
  const [workspaceSlug, setWorkspaceSlug] = useState("");
  const [sessionsFound, setSessionsFound] = useState(0);
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const completeOnboarding = useCompleteOnboarding();

  async function handleSkip() {
    // Create a default workspace so the user isn't left workspace-less
    const name = initialWorkspaceName || "My Workspace";
    try {
      const res = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, sessionBasePath: "~/.claude" }),
      });
      if (!res.ok) {
        // If workspace creation fails (e.g. already exists), still complete onboarding
        console.warn("Skip: workspace creation failed, completing onboarding anyway");
      }
    } catch {
      // Network error — still complete onboarding
    }
    await completeOnboarding.mutateAsync();
    router.push("/");
  }

  async function handleScanPathNext({
    sessionBasePath,
  }: {
    sessionBasePath: string;
  }) {
    setIsCreatingWorkspace(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: workspaceName, sessionBasePath }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error ?? "Failed to create workspace"
        );
      }
      const workspace = await res.json();
      setWorkspaceSlug(workspace.slug);
      setStep("first-scan");
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Failed to create workspace"
      );
    } finally {
      setIsCreatingWorkspace(false);
    }
  }

  async function handleComplete() {
    await completeOnboarding.mutateAsync();
    router.push("/");
  }

  if (step === "welcome") {
    return (
      <WelcomeModal
        onStart={() => setStep("workspace")}
        onSkip={handleSkip}
      />
    );
  }

  const currentStepIndex = STEP_ORDER.indexOf(step);
  const currentStepNumber = currentStepIndex >= 0 ? currentStepIndex + 1 : 1;

  return (
    <div className="min-h-screen bg-sf-bg-primary flex items-center justify-center p-4">
      <div className="w-full flex flex-col items-center gap-6">
        <OnboardingProgressBar
          currentStep={currentStepNumber}
          totalSteps={TOTAL_STEPS}
        />
        {step === "workspace" && (
          <StepWorkspace
            initialName={workspaceName}
            onNext={({ name }) => {
              setWorkspaceName(name);
              setStep("scan-path");
            }}
          />
        )}

        {step === "scan-path" && (
          <>
            <StepScanPath
              onNext={handleScanPathNext}
              onBack={() => setStep("workspace")}
            />
            {isCreatingWorkspace && (
              <div className="flex items-center gap-2 text-sm text-sf-text-muted">
                <Loader2 size={14} className="animate-spin" />
                <span>Creating workspace…</span>
              </div>
            )}
            {createError && (
              <p className="text-sm text-red-400">{createError}</p>
            )}
          </>
        )}

        {step === "first-scan" && (
          <StepFirstScan
            workspaceSlug={workspaceSlug}
            onNext={(count) => {
              setSessionsFound(count);
              setStep("insights");
            }}
            onBack={() => setStep("scan-path")}
          />
        )}

        {step === "insights" && (
          <StepInsights
            workspaceSlug={workspaceSlug}
            onComplete={handleComplete}
            onBack={() => setStep("first-scan")}
          />
        )}

        <button
          type="button"
          onClick={handleSkip}
          disabled={completeOnboarding.isPending}
          className="text-sf-text-muted text-sm hover:text-sf-text-secondary transition-colors disabled:opacity-50"
        >
          Skip setup
        </button>
      </div>
    </div>
  );
}
