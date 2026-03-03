"use client";

type WelcomeModalProps = {
  onStart: () => void;
  onSkip: () => void;
};

const steps = [
  {
    number: "1",
    label: "Scan sessions",
    description: "Point SessionForge at your Claude Code project directory",
  },
  {
    number: "2",
    label: "Extract insights",
    description: "AI pulls out patterns, decisions, and knowledge from your sessions",
  },
  {
    number: "3",
    label: "Generate content",
    description: "Turn insights into blog posts, docs, and social content",
  },
];

export function WelcomeModal({ onStart, onSkip }: WelcomeModalProps) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-lg bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-8">
        <div className="text-center mb-6">
          <p className="text-sf-accent font-display text-sm font-semibold uppercase tracking-widest mb-3">
            SessionForge
          </p>
          <h2 className="text-2xl font-bold text-sf-text-primary mb-2">
            Welcome to SessionForge!
          </h2>
          <p className="text-sf-text-secondary text-sm">
            Let&apos;s get you set up in just a few steps.
          </p>
        </div>

        <div className="space-y-4 mb-8">
          {steps.map((step) => (
            <div key={step.number} className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-sf-accent/10 border border-sf-accent/30 flex items-center justify-center">
                <span className="text-sf-accent text-sm font-bold">
                  {step.number}
                </span>
              </div>
              <div>
                <p className="text-sf-text-primary font-medium text-sm">
                  {step.label}
                </p>
                <p className="text-sf-text-muted text-xs mt-0.5">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center gap-3">
          <button
            onClick={onStart}
            className="w-full bg-sf-accent text-sf-bg-primary font-medium py-2.5 rounded-sf hover:bg-sf-accent-dim transition-colors"
          >
            Get Started
          </button>
          <button
            onClick={onSkip}
            className="text-sf-text-muted text-sm hover:text-sf-text-secondary transition-colors"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
