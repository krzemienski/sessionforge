"use client";

import { CheckCircle2, XCircle, Loader2, FileText, FileArchive } from "lucide-react";
import type { UploadedFileResult } from "@/lib/sessions/upload-processor";

export type UploadState = "idle" | "uploading" | "processing" | "complete" | "error";

export interface UploadStats {
  uploaded: number;
  new: number;
  updated: number;
  errors: number;
}

interface UploadProgressProps {
  state: UploadState;
  files: Array<{ name: string; size?: number }>;
  results?: UploadedFileResult[];
  stats?: UploadStats;
  progress?: number; // 0-100
  onClose?: () => void;
}

export function UploadProgress({
  state,
  files,
  results = [],
  stats,
  progress = 0,
  onClose,
}: UploadProgressProps) {
  // Calculate progress if not provided
  const calculatedProgress = progress || (results.length / Math.max(files.length, 1)) * 100;
  const isComplete = state === "complete";
  const hasErrors = (stats?.errors ?? 0) > 0;

  // Helper to get file status
  const getFileStatus = (fileName: string): UploadedFileResult | undefined => {
    // Match by filename (strip path if needed)
    const baseName = fileName.split("/").pop() || fileName;
    return results.find((r) => {
      const resultBaseName = r.sessionId.endsWith(".jsonl")
        ? r.sessionId
        : `${r.sessionId}.jsonl`;
      return resultBaseName === baseName || r.sessionId === baseName.replace(".jsonl", "");
    });
  };

  // Helper to render file status icon
  const renderFileIcon = (fileName: string) => {
    const result = getFileStatus(fileName);
    const ext = fileName.toLowerCase().split(".").pop();
    const isZip = ext === "zip";

    if (!result) {
      // Still processing or waiting
      return (
        <Loader2
          size={16}
          className="text-sf-text-muted animate-spin flex-shrink-0"
        />
      );
    }

    if (result.status === "success") {
      return (
        <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />
      );
    }

    if (result.status === "error") {
      return <XCircle size={16} className="text-sf-error flex-shrink-0" />;
    }

    return isZip ? (
      <FileArchive size={16} className="text-sf-text-muted flex-shrink-0" />
    ) : (
      <FileText size={16} className="text-sf-text-muted flex-shrink-0" />
    );
  };

  // Helper to render file status text
  const renderFileStatus = (fileName: string) => {
    const result = getFileStatus(fileName);

    if (!result) {
      if (state === "uploading") {
        return <span className="text-xs text-sf-text-muted">Uploading...</span>;
      }
      if (state === "processing") {
        return <span className="text-xs text-sf-text-muted">Processing...</span>;
      }
      return <span className="text-xs text-sf-text-muted">Waiting...</span>;
    }

    if (result.status === "success") {
      const statusText = result.isNew ? "New session" : "Updated";
      return (
        <span className="text-xs text-green-600 dark:text-green-400">
          {statusText}
        </span>
      );
    }

    if (result.status === "error") {
      return (
        <span className="text-xs text-sf-error" title={result.error}>
          {result.error || "Error"}
        </span>
      );
    }

    return <span className="text-xs text-sf-text-muted">Skipped</span>;
  };

  return (
    <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sf-text-primary">
          {state === "uploading" && "Uploading files..."}
          {state === "processing" && "Processing sessions..."}
          {state === "complete" && "Upload complete"}
          {state === "error" && "Upload failed"}
        </h3>
        {onClose && isComplete && (
          <button
            onClick={onClose}
            className="text-sf-text-secondary hover:text-sf-text-primary text-sm transition-colors"
          >
            Dismiss
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-sf-text-secondary">
          <span>
            {results.length} of {files.length} files processed
          </span>
          <span>{Math.round(calculatedProgress)}%</span>
        </div>
        <div className="w-full bg-sf-bg-tertiary rounded-full h-2 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              hasErrors
                ? "bg-sf-error"
                : isComplete
                ? "bg-green-500"
                : "bg-sf-accent"
            }`}
            style={{ width: `${calculatedProgress}%` }}
          />
        </div>
      </div>

      {/* Summary Stats */}
      {stats && isComplete && (
        <div className="bg-sf-bg-tertiary border border-sf-border rounded-sf px-4 py-2 flex items-center gap-4 text-xs">
          <span className="text-sf-text-secondary">
            <span className="text-sf-text-primary font-medium">{stats.uploaded}</span>{" "}
            uploaded
          </span>
          <span className="text-sf-text-secondary">
            <span className="text-green-600 dark:text-green-400 font-medium">
              {stats.new}
            </span>{" "}
            new
          </span>
          <span className="text-sf-text-secondary">
            <span className="text-sf-text-primary font-medium">{stats.updated}</span>{" "}
            updated
          </span>
          {stats.errors > 0 && (
            <span className="text-sf-text-secondary">
              <span className="text-sf-error font-medium">{stats.errors}</span> errors
            </span>
          )}
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {files.map((file, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 text-sm bg-sf-bg-tertiary rounded-sf px-3 py-2 border border-sf-border"
            >
              {renderFileIcon(file.name)}
              <div className="flex-1 min-w-0">
                <p className="text-sf-text-primary truncate font-mono text-xs">
                  {file.name}
                </p>
                {file.size && (
                  <p className="text-xs text-sf-text-muted">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                )}
              </div>
              <div className="flex-shrink-0">{renderFileStatus(file.name)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Error Summary */}
      {hasErrors && results.some((r) => r.status === "error") && (
        <div className="bg-sf-error/10 border border-sf-error/20 rounded-sf p-3">
          <p className="text-sm font-medium text-sf-error mb-2">Errors occurred:</p>
          <ul className="space-y-1">
            {results
              .filter((r) => r.status === "error")
              .slice(0, 5)
              .map((r, idx) => (
                <li key={idx} className="text-xs text-sf-error">
                  <span className="font-mono">{r.sessionId}</span>:{" "}
                  {r.error || "Unknown error"}
                </li>
              ))}
          </ul>
          {results.filter((r) => r.status === "error").length > 5 && (
            <p className="text-xs text-sf-text-muted mt-2">
              ... and {results.filter((r) => r.status === "error").length - 5} more
            </p>
          )}
        </div>
      )}
    </div>
  );
}
