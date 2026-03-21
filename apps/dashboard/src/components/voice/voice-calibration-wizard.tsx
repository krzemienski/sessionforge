"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Mic, ChevronRight, ChevronLeft, Loader2, CheckCircle, AlertCircle, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Step = "intro" | "samples" | "generating" | "complete" | "error";

interface VoiceCalibrationWizardProps {
  workspace: string;
  onComplete?: () => void;
  onCancel?: () => void;
}

const MIN_SAMPLES = 3;
const MAX_SAMPLES = 5;
const MIN_SAMPLE_LENGTH = 100;

const PLACEHOLDER_SAMPLES = [
  "Paste your first writing sample here — a blog post, technical article, or any piece you've written that represents your voice...",
  "Paste a second writing sample here. The more varied your samples, the better the AI can learn your authentic style...",
  "Paste a third writing sample here...",
];

function StepIndicator({ step }: { step: Step }) {
  const steps = [
    { id: "intro", label: "Intro" },
    { id: "samples", label: "Samples" },
    { id: "complete", label: "Done" },
  ];

  const activeIndex =
    step === "intro" ? 0
    : step === "samples" ? 1
    : step === "generating" ? 1
    : 2;

  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2">
          <div
            className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors",
              i < activeIndex
                ? "bg-sf-accent text-sf-bg-primary"
                : i === activeIndex
                ? "bg-sf-accent text-sf-bg-primary"
                : "bg-sf-bg-tertiary text-sf-text-secondary border border-sf-border"
            )}
          >
            {i < activeIndex ? <CheckCircle size={14} /> : i + 1}
          </div>
          <span
            className={cn(
              "text-xs font-medium",
              i <= activeIndex ? "text-sf-text-primary" : "text-sf-text-secondary"
            )}
          >
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <div
              className={cn(
                "h-px w-8 transition-colors",
                i < activeIndex ? "bg-sf-accent" : "bg-sf-border"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function IntroStep({ onStart, onCancel }: { onStart: () => void; onCancel?: () => void }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-sf bg-sf-accent/10 flex items-center justify-center">
          <Mic size={20} className="text-sf-accent" />
        </div>
        <div>
          <h3 className="text-base font-semibold font-display">Voice Calibration</h3>
          <p className="text-sm text-sf-text-secondary">Teach the AI to write like you</p>
        </div>
      </div>

      <div className="bg-sf-bg-tertiary rounded-sf p-4 space-y-3">
        <p className="text-sm text-sf-text-primary">
          Voice calibration analyzes your existing writing to learn your authentic style — vocabulary, tone, sentence structure, and the patterns that make your content uniquely yours.
        </p>
        <ul className="space-y-2">
          {[
            "Paste 3–5 samples of your own writing",
            "Analysis completes in under 30 seconds",
            "All generated content will match your voice",
            "Recalibrate anytime with new samples",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-sf-text-secondary">
              <CheckCircle size={14} className="text-sf-accent mt-0.5 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-sf-bg-tertiary rounded-sf p-4">
        <p className="text-xs font-semibold text-sf-text-secondary uppercase tracking-wide mb-2">Good sample sources</p>
        <p className="text-sm text-sf-text-secondary">
          Blog posts, technical articles, LinkedIn updates, emails, documentation — any writing where you had full creative control and weren&apos;t constrained to a specific template.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onStart}
          className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors"
        >
          Get Started
          <ChevronRight size={16} />
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-sm text-sf-text-secondary hover:text-sf-text-primary transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

function SamplesStep({
  samples,
  onSamplesChange,
  onBack,
  onSubmit,
  isSubmitting,
}: {
  samples: string[];
  onSamplesChange: (samples: string[]) => void;
  onBack: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}) {
  const validSamples = samples.filter((s) => s.trim().length >= MIN_SAMPLE_LENGTH);
  const canSubmit = validSamples.length >= MIN_SAMPLES && !isSubmitting;

  function updateSample(index: number, value: string) {
    const next = [...samples];
    next[index] = value;
    onSamplesChange(next);
  }

  function addSample() {
    if (samples.length < MAX_SAMPLES) {
      onSamplesChange([...samples, ""]);
    }
  }

  function removeSample(index: number) {
    if (samples.length > MIN_SAMPLES) {
      onSamplesChange(samples.filter((_, i) => i !== index));
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold font-display mb-1">Paste Your Writing Samples</h3>
        <p className="text-sm text-sf-text-secondary">
          Add {MIN_SAMPLES}–{MAX_SAMPLES} samples of your writing. Each sample should be at least {MIN_SAMPLE_LENGTH} characters.
        </p>
      </div>

      <div className="space-y-3">
        {samples.map((sample, i) => {
          const charCount = sample.trim().length;
          const isValid = charCount >= MIN_SAMPLE_LENGTH;
          return (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-sf-text-secondary">
                  Sample {i + 1}
                  {isValid && <span className="ml-2 text-sf-success text-xs">✓</span>}
                </label>
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs tabular-nums", isValid ? "text-sf-success" : "text-sf-text-secondary")}>
                    {charCount} / {MIN_SAMPLE_LENGTH} min
                  </span>
                  {samples.length > MIN_SAMPLES && (
                    <button
                      onClick={() => removeSample(i)}
                      className="text-sf-text-secondary hover:text-sf-error transition-colors"
                      aria-label={`Remove sample ${i + 1}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
              <textarea
                value={sample}
                onChange={(e) => updateSample(i, e.target.value)}
                rows={5}
                placeholder={PLACEHOLDER_SAMPLES[i] ?? `Paste writing sample ${i + 1} here...`}
                className={cn(
                  "w-full bg-sf-bg-tertiary border rounded-sf px-3 py-2 text-sm text-sf-text-primary resize-y focus:outline-none transition-colors",
                  isValid && sample.length > 0
                    ? "border-sf-success/50 focus:border-sf-success"
                    : "border-sf-border focus:border-sf-border-focus"
                )}
              />
            </div>
          );
        })}
      </div>

      {samples.length < MAX_SAMPLES && (
        <button
          onClick={addSample}
          className="flex items-center gap-2 text-sm text-sf-accent hover:text-sf-accent-dim transition-colors"
        >
          <Plus size={14} />
          Add another sample ({samples.length}/{MAX_SAMPLES})
        </button>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={onSubmit}
          disabled={!canSubmit}
          className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Starting Analysis...
            </>
          ) : (
            <>
              Analyze My Voice
              <ChevronRight size={16} />
            </>
          )}
        </button>
        <button
          onClick={onBack}
          disabled={isSubmitting}
          className="flex items-center gap-2 text-sm text-sf-text-secondary hover:text-sf-text-primary transition-colors disabled:opacity-50"
        >
          <ChevronLeft size={14} />
          Back
        </button>
      </div>

      {validSamples.length < MIN_SAMPLES && (
        <p className="text-xs text-sf-text-secondary">
          {MIN_SAMPLES - validSamples.length} more sample{MIN_SAMPLES - validSamples.length !== 1 ? "s" : ""} needed (each at least {MIN_SAMPLE_LENGTH} characters)
        </p>
      )}
    </div>
  );
}

function GeneratingStep() {
  return (
    <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center">
      <div className="w-14 h-14 rounded-full bg-sf-accent/10 flex items-center justify-center">
        <Loader2 size={28} className="text-sf-accent animate-spin" />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold font-display">Analyzing Your Writing</h3>
        <p className="text-sm text-sf-text-secondary max-w-xs">
          The AI is learning your vocabulary, tone, and style patterns. This usually takes under 30 seconds.
        </p>
      </div>
      <div className="flex gap-1 mt-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-sf-accent animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

function CompleteStep({ onDone }: { onDone: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center">
      <div className="w-14 h-14 rounded-full bg-sf-success/10 flex items-center justify-center">
        <CheckCircle size={28} className="text-sf-success" />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold font-display">Voice Profile Created</h3>
        <p className="text-sm text-sf-text-secondary max-w-xs">
          Your voice profile has been calibrated. All future content generation will reflect your authentic writing style.
        </p>
      </div>
      <button
        onClick={onDone}
        className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors mt-2"
      >
        <CheckCircle size={16} />
        Done
      </button>
    </div>
  );
}

function ErrorStep({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center">
      <div className="w-14 h-14 rounded-full bg-sf-error/10 flex items-center justify-center">
        <AlertCircle size={28} className="text-sf-error" />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold font-display">Calibration Failed</h3>
        <p className="text-sm text-sf-text-secondary max-w-xs">{message}</p>
      </div>
      <button
        onClick={onRetry}
        className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors mt-2"
      >
        Try Again
      </button>
    </div>
  );
}

export function VoiceCalibrationWizard({ workspace, onComplete, onCancel }: VoiceCalibrationWizardProps) {
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>("intro");
  const [samples, setSamples] = useState<string[]>(["", "", ""]);
  const [errorMessage, setErrorMessage] = useState("");

  const calibrate = useMutation({
    mutationFn: async (writingSamples: string[]) => {
      const res = await fetch(`/api/workspace/${workspace}/style-profile/calibrate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ samples: writingSamples }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Calibration request failed");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["voice-profile", workspace] });
      qc.invalidateQueries({ queryKey: ["style", workspace] });
      setStep("complete");
    },
    onError: (err: Error) => {
      setErrorMessage(err.message || "An unexpected error occurred. Please try again.");
      setStep("error");
    },
  });

  function handleSubmitSamples() {
    const validSamples = samples.filter((s) => s.trim().length >= MIN_SAMPLE_LENGTH);
    if (validSamples.length < MIN_SAMPLES) return;
    setStep("generating");
    calibrate.mutate(validSamples);
  }

  function handleRetry() {
    setStep("samples");
    setErrorMessage("");
  }

  function handleDone() {
    onComplete?.();
  }

  return (
    <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6">
      <StepIndicator step={step} />

      {step === "intro" && (
        <IntroStep onStart={() => setStep("samples")} onCancel={onCancel} />
      )}
      {step === "samples" && (
        <SamplesStep
          samples={samples}
          onSamplesChange={setSamples}
          onBack={() => setStep("intro")}
          onSubmit={handleSubmitSamples}
          isSubmitting={calibrate.isPending}
        />
      )}
      {step === "generating" && <GeneratingStep />}
      {step === "complete" && <CompleteStep onDone={handleDone} />}
      {step === "error" && <ErrorStep message={errorMessage} onRetry={handleRetry} />}
    </div>
  );
}
