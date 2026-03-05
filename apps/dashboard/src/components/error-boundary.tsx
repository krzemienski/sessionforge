"use client";

import React from "react";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Structured error logging — avoids leaking details to the client
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("[ErrorBoundary]", error.message, info.componentStack);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

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
              An unexpected error occurred. You can try again or return home.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={this.handleReset}
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

    return this.props.children;
  }
}
