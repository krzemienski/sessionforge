"use client";

import { useState, useEffect } from "react";
import { Save, ShieldCheck, ToggleLeft, ToggleRight } from "lucide-react";
import { useApprovalSettings, useUpdateApprovalSettings } from "@/hooks/use-approval";

interface ApprovalSettingsTabProps {
  workspace: string;
}

export function ApprovalSettingsTab({ workspace }: ApprovalSettingsTabProps) {
  const settings = useApprovalSettings(workspace);
  const update = useUpdateApprovalSettings();

  const [enabled, setEnabled] = useState(false);
  const [requiredApprovers, setRequiredApprovers] = useState(1);

  useEffect(() => {
    if (settings.data) {
      setEnabled(settings.data.enabled ?? false);
      setRequiredApprovers(settings.data.requiredApprovers ?? 1);
    }
  }, [settings.data]);

  const handleSave = () => {
    update.mutate({ workspace, enabled, requiredApprovers });
  };

  if (settings.isLoading) {
    return <div className="animate-pulse space-y-4"><div className="h-8 bg-sf-bg-tertiary rounded w-1/3" /></div>;
  }

  return (
    <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6 space-y-5">
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck size={18} className="text-sf-accent" />
        <h2 className="text-base font-semibold font-display">Approval Workflow</h2>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-sf-text-primary">Enable Approval Workflow</p>
          <p className="text-xs text-sf-text-muted mt-0.5">
            Require content to be reviewed and approved before publishing.
          </p>
        </div>
        <button
          onClick={() => setEnabled(!enabled)}
          className="p-2 text-sf-text-muted hover:text-sf-text-primary transition-colors"
        >
          {enabled ? (
            <ToggleRight size={24} className="text-sf-success" />
          ) : (
            <ToggleLeft size={24} />
          )}
        </button>
      </div>

      {enabled && (
        <>
          <div>
            <label className="block text-sm font-medium text-sf-text-secondary mb-1">
              Required Approvers
            </label>
            <input
              type="number"
              value={requiredApprovers}
              onChange={(e) => setRequiredApprovers(Math.max(1, parseInt(e.target.value) || 1))}
              min={1}
              max={10}
              className="w-32 bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary focus:outline-none focus:border-sf-border-focus"
            />
            <p className="text-xs text-sf-text-muted mt-1">
              Number of approvals required before content can be published.
            </p>
          </div>
        </>
      )}

      <button
        onClick={handleSave}
        disabled={update.isPending}
        className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
      >
        <Save size={16} />
        {update.isPending ? "Saving..." : "Save Settings"}
      </button>
      {update.isSuccess && <p className="text-sm text-sf-success">Approval settings saved.</p>}
      {update.isError && <p className="text-sm text-sf-error">Failed to save approval settings.</p>}
    </div>
  );
}
