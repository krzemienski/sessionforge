"use client";

import { Mic } from "lucide-react";
import { VoiceCalibrationWizard } from "@/components/voice/voice-calibration-wizard";

interface VoiceProfileTabProps {
  workspace: string;
}

export function VoiceProfileTab({ workspace }: VoiceProfileTabProps) {
  return (
    <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6 space-y-5">
      <div className="flex items-center gap-2 mb-1">
        <Mic size={18} className="text-sf-accent" />
        <h2 className="text-base font-semibold font-display">Voice Profile</h2>
      </div>

      <VoiceCalibrationWizard workspace={workspace} />
    </div>
  );
}
