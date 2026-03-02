"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { CheckCircle, XCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

type Listener = (toasts: Toast[]) => void;

let toasts: Toast[] = [];
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l([...toasts]));
}

export function showToast(message: string, type: ToastType = "info", duration = 3000) {
  const id = Math.random().toString(36).slice(2);
  toasts = [...toasts, { id, message, type }];
  notify();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    notify();
  }, duration);
}

function useToasts(): Toast[] {
  const [state, setState] = useState<Toast[]>([...toasts]);
  useEffect(() => {
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);
  return state;
}

const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle size={16} className="text-sf-success flex-shrink-0" />,
  error: <XCircle size={16} className="text-sf-danger flex-shrink-0" />,
  info: <Info size={16} className="text-sf-info flex-shrink-0" />,
};

const borderColors: Record<ToastType, string> = {
  success: "border-sf-success/30",
  error: "border-sf-danger/30",
  info: "border-sf-info/30",
};

function dismiss(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}

export function ToastContainer() {
  const items = useToasts();

  if (items.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
      aria-label="Notifications"
    >
      {items.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-[var(--radius-sf)]",
            "bg-sf-bg-secondary border pointer-events-auto",
            "shadow-[var(--shadow-sf-lg)]",
            "text-sf-text-primary text-sm font-body",
            "animate-in fade-in slide-in-from-bottom-2 duration-200",
            borderColors[toast.type]
          )}
        >
          {icons[toast.type]}
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => dismiss(toast.id)}
            className="text-sf-text-muted hover:text-sf-text-secondary transition-colors ml-1"
            aria-label="Dismiss notification"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
