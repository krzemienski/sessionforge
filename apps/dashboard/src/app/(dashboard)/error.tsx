"use client";

import { AlertTriangle, Home, RotateCcw } from "lucide-react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: ErrorProps) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-6 p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-sf-lg bg-sf-danger/10">
          <AlertTriangle className="h-6 w-6 text-sf-danger" />
        </div>
        <h2 className="text-lg font-semibold text-sf-text-primary">
          Something went wrong
        </h2>
        <p className="max-w-sm text-sm text-sf-text-secondary">
          {error.digest
            ? `An unexpected error occurred (ref: ${error.digest}). Please try again.`
            : "An unexpected error occurred. You can try again or return home."}
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={reset}
          className="flex items-center gap-2 rounded-sf border border-sf-border bg-sf-bg-secondary px-4 py-2 text-sm font-medium text-sf-text-primary transition-colors hover:bg-sf-bg-hover"
        >
          <RotateCcw className="h-4 w-4" />
          Try Again
        </button>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/"
          className="flex items-center gap-2 rounded-sf border border-sf-border bg-sf-bg-secondary px-4 py-2 text-sm font-medium text-sf-text-primary transition-colors hover:bg-sf-bg-hover"
        >
          <Home className="h-4 w-4" />
          Go Home
        </a>
      </div>
    </div>
  );
}
