"use client";

import { X, Download, Loader2 } from "lucide-react";
import { TYPE_LABELS } from "@/lib/content-constants";

interface ExportPanelProps {
  showExport: boolean;
  onClose: () => void;
  exportType: string;
  setExportType: (v: string) => void;
  exportStatus: string;
  setExportStatus: (v: string) => void;
  exportDateFrom: string;
  setExportDateFrom: (v: string) => void;
  exportDateTo: string;
  setExportDateTo: (v: string) => void;
  isExporting: boolean;
  exportCount: number | null;
  onExport: () => void;
}

export function ExportPanel({
  showExport,
  onClose,
  exportType,
  setExportType,
  exportStatus,
  setExportStatus,
  exportDateFrom,
  setExportDateFrom,
  exportDateTo,
  setExportDateTo,
  isExporting,
  exportCount,
  onExport,
}: ExportPanelProps) {
  if (!showExport) return null;

  return (
    <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-4 mb-6 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sf-text-primary text-sm">Export Options</h3>
        <button onClick={onClose} className="text-sf-text-muted hover:text-sf-text-secondary">
          <X size={16} />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <select
          value={exportType}
          onChange={(e) => setExportType(e.target.value)}
          className="bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary min-h-[44px]"
        >
          <option value="">All Types</option>
          {Object.entries(TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select
          value={exportStatus}
          onChange={(e) => setExportStatus(e.target.value)}
          className="bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary min-h-[44px]"
        >
          <option value="">All Statuses</option>
          <option value="idea">Idea</option>
          <option value="draft">Draft</option>
          <option value="in_review">In Review</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-sf-text-muted mb-1">From</label>
          <input
            type="date"
            value={exportDateFrom}
            onChange={(e) => setExportDateFrom(e.target.value)}
            className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary min-h-[44px]"
          />
        </div>
        <div>
          <label className="block text-xs text-sf-text-muted mb-1">To</label>
          <input
            type="date"
            value={exportDateTo}
            onChange={(e) => setExportDateTo(e.target.value)}
            className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sm text-sf-text-primary min-h-[44px]"
          />
        </div>
      </div>
      {exportCount !== null && exportCount >= 50 && !isExporting && (
        <p className="text-xs text-sf-text-muted">
          {exportCount} files — large exports may take a moment to prepare.
        </p>
      )}
      {isExporting && (
        <p className="text-xs text-sf-text-muted flex items-center gap-1.5">
          <Loader2 size={12} className="animate-spin" /> Building zip archive…
        </p>
      )}
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          onClick={onExport}
          disabled={isExporting}
          className="flex items-center justify-center gap-2 bg-sf-accent text-sf-bg-primary px-4 py-2 rounded-sf text-sm font-medium disabled:opacity-50 transition-opacity w-full sm:w-auto min-h-[44px]"
        >
          {isExporting ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Exporting…
            </>
          ) : (
            <>
              <Download size={14} /> Download ZIP
            </>
          )}
        </button>
        <button onClick={onClose} className="text-sf-text-secondary px-4 py-2 text-sm w-full sm:w-auto min-h-[44px]">
          Cancel
        </button>
      </div>
    </div>
  );
}
