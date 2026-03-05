"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { Upload, FileText, FileArchive } from "lucide-react";

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  isUploading?: boolean;
  maxFileSizeMB?: number;
}

export function UploadZone({
  onFilesSelected,
  isUploading = false,
  maxFileSizeMB = 50,
}: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFiles = (files: File[]): { valid: File[]; errors: string[] } => {
    const valid: File[] = [];
    const errors: string[] = [];
    const maxBytes = maxFileSizeMB * 1024 * 1024;

    for (const file of files) {
      // Check file size
      if (file.size > maxBytes) {
        errors.push(`${file.name} exceeds ${maxFileSizeMB}MB limit`);
        continue;
      }

      // Check file extension
      const ext = file.name.toLowerCase().split(".").pop();
      if (ext !== "jsonl" && ext !== "zip") {
        errors.push(`${file.name} is not a .jsonl or .zip file`);
        continue;
      }

      valid.push(file);
    }

    return { valid, errors };
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const { valid, errors } = validateFiles(fileArray);

    if (errors.length > 0) {
      setError(errors.join("; "));
      setTimeout(() => setError(null), 5000);
    }

    if (valid.length > 0) {
      setError(null);
      onFilesSelected(valid);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (isUploading) return;

    handleFiles(e.dataTransfer.files);
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClick = () => {
    if (!isUploading && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="w-full">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`
          relative border-2 border-dashed rounded-sf-lg p-8 text-center cursor-pointer
          transition-all duration-200
          ${
            isDragging
              ? "border-sf-accent bg-sf-accent/5 scale-[1.02]"
              : "border-sf-border bg-sf-bg-secondary hover:border-sf-border-focus hover:bg-sf-bg-hover"
          }
          ${isUploading ? "opacity-50 cursor-not-allowed" : ""}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".jsonl,.zip"
          multiple
          onChange={handleFileInputChange}
          disabled={isUploading}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <Upload
              size={32}
              className={`
                transition-colors
                ${isDragging ? "text-sf-accent" : "text-sf-text-muted"}
              `}
            />
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium text-sf-text-primary">
              {isDragging
                ? "Drop files here"
                : "Drag & drop session files or click to browse"}
            </p>
            <p className="text-xs text-sf-text-secondary">
              Supports <span className="font-mono">.jsonl</span> and{" "}
              <span className="font-mono">.zip</span> files up to {maxFileSizeMB}MB
            </p>
          </div>

          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1.5 text-xs text-sf-text-muted">
              <FileText size={14} />
              <span>Single file</span>
            </div>
            <div className="text-sf-text-tertiary">or</div>
            <div className="flex items-center gap-1.5 text-xs text-sf-text-muted">
              <FileArchive size={14} />
              <span>Bulk upload</span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-3 p-3 bg-sf-error/10 border border-sf-error/20 rounded-sf">
          <p className="text-sm text-sf-error">{error}</p>
        </div>
      )}
    </div>
  );
}
