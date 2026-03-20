"use client";

import { useState, useRef, useEffect } from "react";
import { Download, Upload, AlertTriangle, CheckCircle, XCircle, Loader2, FileArchive } from "lucide-react";

interface BackupRestoreTabProps {
  workspace: string;
}

type JobStatus = "pending" | "running" | "completed" | "failed";

interface JobInfo {
  id: string;
  status: JobStatus;
  progress?: number;
  result?: Record<string, unknown>;
  error?: string;
}

interface ValidationReport {
  valid: boolean;
  errors: string[];
  warnings: string[];
  summary?: Record<string, unknown>;
}

export function BackupRestoreTab({ workspace }: BackupRestoreTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Backup state
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [backupSuccess, setBackupSuccess] = useState(false);

  // Restore state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreJobId, setRestoreJobId] = useState<string | null>(null);
  const [jobInfo, setJobInfo] = useState<JobInfo | null>(null);

  // Poll job status
  useEffect(() => {
    if (!restoreJobId) return;
    if (jobInfo?.status === "completed" || jobInfo?.status === "failed") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${restoreJobId}`);
        if (!res.ok) return;
        const data = await res.json();
        setJobInfo(data);
      } catch {
        // silently ignore poll errors
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [restoreJobId, jobInfo?.status]);

  const handleCreateBackup = async () => {
    setIsCreatingBackup(true);
    setBackupError(null);
    setBackupSuccess(false);

    try {
      const res = await fetch("/api/backups/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceSlug: workspace }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create backup");
      }

      // Trigger file download from the response blob
      const blob = await res.blob();
      const contentDisposition = res.headers.get("content-disposition");
      let filename = `backup-${workspace}-${new Date().toISOString().slice(0, 10)}.zip`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match) filename = match[1];
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setBackupSuccess(true);
      setTimeout(() => setBackupSuccess(false), 5000);
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setValidationReport(null);
    setValidationError(null);
    setRestoreError(null);
    setRestoreJobId(null);
    setJobInfo(null);
    setIsValidating(true);

    try {
      const formData = new FormData();
      formData.append("bundle", file);
      formData.append("workspaceSlug", workspace);

      const res = await fetch("/api/backups/validate", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Validation failed");
      }

      const report: ValidationReport = await res.json();
      setValidationReport(report);
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsValidating(false);
    }
  };

  const handleRestore = async () => {
    if (!selectedFile || !validationReport) return;

    setIsRestoring(true);
    setRestoreError(null);
    setRestoreJobId(null);
    setJobInfo(null);

    try {
      const formData = new FormData();
      formData.append("bundle", selectedFile);
      formData.append("workspaceSlug", workspace);

      const res = await fetch("/api/backups/restore", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to start restore");
      }

      const data = await res.json();
      setRestoreJobId(data.jobId);
      setJobInfo({ id: data.jobId, status: "pending" });
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsRestoring(false);
    }
  };

  const handleClearRestore = () => {
    setSelectedFile(null);
    setValidationReport(null);
    setValidationError(null);
    setRestoreError(null);
    setRestoreJobId(null);
    setJobInfo(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const jobDone = jobInfo?.status === "completed" || jobInfo?.status === "failed";

  return (
    <div className="space-y-6">
      {/* Create Backup Section */}
      <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6">
        <div className="flex items-center gap-2 mb-3">
          <FileArchive size={18} className="text-sf-accent" />
          <h2 className="text-base font-semibold font-display">Create Backup</h2>
        </div>
        <p className="text-sm text-sf-text-secondary mb-4">
          Export all content, assets, tags, series, and metadata into a portable backup bundle.
        </p>

        <button
          onClick={handleCreateBackup}
          disabled={isCreatingBackup}
          className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
        >
          {isCreatingBackup ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Download size={16} />
          )}
          {isCreatingBackup ? "Creating backup…" : "Create Backup"}
        </button>

        {backupError && (
          <div className="flex items-center gap-2 mt-3 text-sm text-sf-error">
            <XCircle size={16} />
            {backupError}
          </div>
        )}

        {backupSuccess && (
          <div className="flex items-center gap-2 mt-3 text-sm text-sf-success">
            <CheckCircle size={16} />
            Backup downloaded successfully.
          </div>
        )}
      </div>

      {/* Restore from Backup Section */}
      <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6">
        <div className="flex items-center gap-2 mb-3">
          <Upload size={18} className="text-sf-accent" />
          <h2 className="text-base font-semibold font-display">Restore from Backup</h2>
        </div>
        <p className="text-sm text-sf-text-secondary mb-4">
          Upload a backup bundle to restore content into this workspace. The bundle will be validated before import begins.
        </p>

        {/* File input */}
        {!selectedFile && (
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-sf-border rounded-sf-lg p-8 cursor-pointer hover:border-sf-border-focus transition-colors bg-sf-bg-tertiary">
            <Upload size={24} className="text-sf-text-muted mb-2" />
            <span className="text-sm font-medium text-sf-text-secondary">Click to select a backup file</span>
            <span className="text-xs text-sf-text-muted mt-1">.zip backup bundles supported</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              onChange={handleFileChange}
              className="sr-only"
            />
          </label>
        )}

        {/* Selected file + validation */}
        {selectedFile && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-sf-bg-tertiary border border-sf-border rounded-sf">
              <div className="flex items-center gap-2">
                <FileArchive size={16} className="text-sf-text-secondary" />
                <span className="text-sm text-sf-text-primary">{selectedFile.name}</span>
                <span className="text-xs text-sf-text-muted">
                  ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </span>
              </div>
              <button
                onClick={handleClearRestore}
                className="text-xs text-sf-text-muted hover:text-sf-text-secondary transition-colors"
              >
                Change file
              </button>
            </div>

            {/* Validating */}
            {isValidating && (
              <div className="flex items-center gap-2 text-sm text-sf-text-secondary">
                <Loader2 size={16} className="animate-spin" />
                Validating backup bundle…
              </div>
            )}

            {/* Validation error */}
            {validationError && (
              <div className="flex items-center gap-2 p-3 bg-sf-error/10 border border-sf-error/30 rounded-sf text-sm text-sf-error">
                <XCircle size={16} className="flex-shrink-0" />
                {validationError}
              </div>
            )}

            {/* Validation report */}
            {validationReport && (
              <div className="space-y-3">
                <div className={`flex items-center gap-2 p-3 rounded-sf border ${
                  validationReport.valid
                    ? "bg-sf-success/10 border-sf-success/30"
                    : "bg-sf-error/10 border-sf-error/30"
                }`}>
                  {validationReport.valid ? (
                    <CheckCircle size={16} className="text-sf-success flex-shrink-0" />
                  ) : (
                    <XCircle size={16} className="text-sf-error flex-shrink-0" />
                  )}
                  <span className={`text-sm font-medium ${validationReport.valid ? "text-sf-success" : "text-sf-error"}`}>
                    {validationReport.valid ? "Backup is valid and ready to restore." : "Backup validation failed."}
                  </span>
                </div>

                {validationReport.errors.length > 0 && (
                  <div className="p-3 bg-sf-error/10 border border-sf-error/30 rounded-sf space-y-1">
                    <p className="text-xs font-semibold text-sf-error mb-2">Errors ({validationReport.errors.length})</p>
                    {validationReport.errors.map((err, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-sf-error">
                        <XCircle size={12} className="flex-shrink-0 mt-0.5" />
                        {err}
                      </div>
                    ))}
                  </div>
                )}

                {validationReport.warnings.length > 0 && (
                  <div className="p-3 bg-sf-warning/10 border border-sf-warning/30 rounded-sf space-y-1">
                    <p className="text-xs font-semibold text-sf-warning mb-2">Warnings ({validationReport.warnings.length})</p>
                    {validationReport.warnings.map((warn, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-sf-warning">
                        <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                        {warn}
                      </div>
                    ))}
                  </div>
                )}

                {/* Restore button */}
                {validationReport.valid && !restoreJobId && (
                  <button
                    onClick={handleRestore}
                    disabled={isRestoring}
                    className="flex items-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf font-medium text-sm hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
                  >
                    {isRestoring ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Upload size={16} />
                    )}
                    {isRestoring ? "Starting restore…" : "Restore Backup"}
                  </button>
                )}

                {restoreError && (
                  <div className="flex items-center gap-2 text-sm text-sf-error">
                    <XCircle size={16} />
                    {restoreError}
                  </div>
                )}
              </div>
            )}

            {/* Job status */}
            {jobInfo && (
              <div className={`p-4 border rounded-sf-lg space-y-2 ${
                jobInfo.status === "completed"
                  ? "bg-sf-success/10 border-sf-success/30"
                  : jobInfo.status === "failed"
                  ? "bg-sf-error/10 border-sf-error/30"
                  : "bg-sf-bg-tertiary border-sf-border"
              }`}>
                <div className="flex items-center gap-2">
                  {jobInfo.status === "completed" && <CheckCircle size={16} className="text-sf-success" />}
                  {jobInfo.status === "failed" && <XCircle size={16} className="text-sf-error" />}
                  {(jobInfo.status === "pending" || jobInfo.status === "running") && (
                    <Loader2 size={16} className="animate-spin text-sf-accent" />
                  )}
                  <span className="text-sm font-medium text-sf-text-primary capitalize">
                    {jobInfo.status === "pending" && "Restore queued…"}
                    {jobInfo.status === "running" && `Restoring… ${jobInfo.progress != null ? `${jobInfo.progress}%` : ""}`}
                    {jobInfo.status === "completed" && "Restore completed successfully."}
                    {jobInfo.status === "failed" && "Restore failed."}
                  </span>
                </div>

                {jobInfo.status === "running" && jobInfo.progress != null && (
                  <div className="w-full bg-sf-bg-primary rounded-full h-1.5">
                    <div
                      className="bg-sf-accent h-1.5 rounded-full transition-all"
                      style={{ width: `${jobInfo.progress}%` }}
                    />
                  </div>
                )}

                {jobInfo.status === "failed" && jobInfo.error && (
                  <p className="text-xs text-sf-error">{jobInfo.error}</p>
                )}

                {jobDone && (
                  <button
                    onClick={handleClearRestore}
                    className="text-xs text-sf-text-muted hover:text-sf-text-secondary transition-colors mt-1"
                  >
                    Start over
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
