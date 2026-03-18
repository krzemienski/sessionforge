"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

const STORAGE_KEY = "sf_onboarding_started_at";

function formatTime(seconds: number): string {
  const mm = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const ss = (seconds % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export function OnboardingTimer() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    // Record start time if not already set
    if (!localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
    }

    function tick() {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const startedAt = parseInt(stored, 10);
      const seconds = Math.floor((Date.now() - startedAt) / 1000);
      setElapsed(Math.max(0, seconds));
    }

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-1.5 text-xs text-sf-text-muted">
      <Clock size={12} />
      <span className="tabular-nums">{formatTime(elapsed)}</span>
    </div>
  );
}
