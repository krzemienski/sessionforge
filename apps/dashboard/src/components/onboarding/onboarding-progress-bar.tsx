"use client";

type OnboardingProgressBarProps = {
  currentStep: number;
  totalSteps: number;
};

export function OnboardingProgressBar({
  currentStep,
  totalSteps,
}: OnboardingProgressBarProps) {
  const percent = Math.round((currentStep / totalSteps) * 100);

  return (
    <div className="w-full max-w-lg">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-medium text-sf-text-muted uppercase tracking-widest">
          Step {currentStep} of {totalSteps}
        </span>
        <span className="text-xs text-sf-text-muted">{percent}%</span>
      </div>
      <div className="h-1.5 bg-sf-bg-tertiary rounded-full overflow-hidden">
        <div
          className="h-full bg-sf-accent rounded-full transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
