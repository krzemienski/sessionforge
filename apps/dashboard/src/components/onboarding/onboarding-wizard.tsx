"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { WelcomeModal } from "./welcome-modal";
import { StepWorkspace } from "./steps/step-workspace";
import { StepScanPath } from "./steps/step-scan-path";
import { StepFirstScan } from "./steps/step-first-scan";
import { StepInsights } from "./steps/step-insights";
import { StepGeneratePost } from "./steps/step-generate-post";
import { useCompleteOnboarding, useTrackOnboardingStep } from "@/hooks/use-onboarding";
import { OnboardingProgressBar } from "./onboarding-progress-bar";
import { OnboardingTimer } from "./onboarding-timer";

type Step = "welcome" | "workspace" | "scan-path" | "first-scan" | "insights" | "generate-post";

const STEP_ORDER: Step[] = ["workspace", "scan-path", "first-scan", "insights", "generate-post"];
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
  const trackStep = useTrackOnboardingStep();

  // Track when welcome step is shown (on component mount)
  useEffect(() => {
    if (step === "welcome") {
      trackStep("welcome", "entered");
    }
  }, [step, trackStep]);

  async function handleSkip() {
    trackStep(step, "skipped", { currentStep: step });
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
      trackStep("first-scan", "entered");
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Failed to create workspace"
      );
    } finally {
      setIsCreatingWorkspace(false);
    }
  }

  async function handleComplete() {
    trackStep("generate-post", "completed");
    await completeOnboarding.mutateAsync();
    router.push("/");
  }

  if (step === "welcome") {
    return (
      <WelcomeModal
        onStart={() => {
          localStorage.setItem("sf_onboarding_started_at", Date.now().toString());
          setStep("workspace");
          trackStep("workspace", "entered");
        }}
        onSkip={handleSkip}
      />
    );
  }

  const currentStepIndex = STEP_ORDER.indexOf(step);
  const currentStepNumber = currentStepIndex >= 0 ? currentStepIndex + 1 : 1;

  return (
    <div className="min-h-screen bg-sf-bg-primary flex items-center justify-center p-4">
      <div className="w-full flex flex-col items-center gap-6">
        <div className="w-full max-w-lg flex flex-col gap-2">
          <OnboardingProgressBar
            currentStep={currentStepNumber}
            totalSteps={TOTAL_STEPS}
          />
          <div className="flex justify-end">
            <OnboardingTimer />
          </div>
        </div>
        {step === "workspace" && (
          <StepWorkspace
            initialName={workspaceName}
            onNext={({ name }) => {
              setWorkspaceName(name);
              setStep("scan-path");
              trackStep("scan-path", "entered");
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
              trackStep("insights", "entered", { sessionsFound: count });
            }}
            onBack={() => setStep("scan-path")}
          />
        )}

        {step === "insights" && (
          <StepInsights
            workspaceSlug={workspaceSlug}
            onComplete={() => {
              setStep("generate-post");
              trackStep("generate-post", "entered");
            }}
            onBack={() => setStep("first-scan")}
          />
        )}

        {step === "generate-post" && (
          <StepGeneratePost
            workspaceSlug={workspaceSlug}
            onComplete={handleComplete}
            onBack={() => setStep("insights")}
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
