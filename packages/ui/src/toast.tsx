"use client";

import * as React from "react";
import { CircleCheck, CircleAlert, Info, X } from "lucide-react";
import { cn } from "@plink/core/utils";

type ToastKind = "success" | "error" | "info";
type Toast = { id: number; kind: ToastKind; message: string };

const ToastContext = React.createContext<{
  toast: (message: string, kind?: ToastKind) => void;
} | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const nextId = React.useRef(0);

  const dismiss = React.useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = React.useCallback(
    (message: string, kind: ToastKind = "success") => {
      const id = ++nextId.current;
      setToasts((t) => [...t, { id, kind, message }]);
      setTimeout(() => dismiss(id), 4200);
    },
    [dismiss],
  );

  const value = React.useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-5 left-1/2 z-[100] flex w-[min(92vw,26rem)] -translate-x-1/2 flex-col gap-2"
        role="region"
        aria-live="polite"
      >
        {toasts.map((t) => {
          const Icon = t.kind === "success" ? CircleCheck : t.kind === "error" ? CircleAlert : Info;
          return (
            <div
              key={t.id}
              className={cn(
                "pointer-events-auto flex items-start gap-2.5 rounded-md border px-4 py-3 shadow-modal animate-pop",
                t.kind === "error"
                  ? "border-danger-soft bg-surface text-danger-deep"
                  : t.kind === "info"
                    ? "border-line bg-surface text-ink"
                    : "border-line bg-surface text-ink",
              )}
            >
              <Icon className="mt-px size-4 shrink-0" aria-hidden />
              <p className="min-w-0 flex-1 text-[14px] leading-5 tracking-[-0.02em]">{t.message}</p>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="shrink-0 rounded-md p-0.5 opacity-60 transition hover:opacity-100"
              >
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) return { toast: () => {} };
  return ctx;
}
