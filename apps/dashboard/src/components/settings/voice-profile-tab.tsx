"use client";

import { VoiceCalibrationWizard } from "@/components/voice/voice-calibration-wizard";
import { VoiceParametersPanel } from "@/components/voice/voice-parameters-panel";

interface VoiceProfileTabProps {
  workspace: string;
}

export function VoiceProfileTab({ workspace }: VoiceProfileTabProps) {
  return (
    <div className="space-y-6">
      <VoiceCalibrationWizard workspace={workspace} />
      <VoiceParametersPanel workspace={workspace} />
    </div>
  );
}
