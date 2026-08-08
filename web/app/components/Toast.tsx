"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type ToastKind = "error" | "info" | "success";

type ToastItem = {
  id: number;
  kind: ToastKind;
  message: string;
};

type ToastContextValue = {
  toast: (message: string, kind?: ToastKind) => void;
  error: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

let toastId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, kind: ToastKind = "info") => {
      const id = ++toastId;
      setItems((prev) => [...prev.slice(-4), { id, kind, message }]);
      window.setTimeout(() => dismiss(id), 5200);
    },
    [dismiss],
  );

  const error = useCallback(
    (message: string) => toast(message, "error"),
    [toast],
  );

  const value = useMemo(() => ({ toast, error }), [toast, error]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(100%-2rem,22rem)] flex-col gap-2"
        aria-live="polite"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className={`pointer-events-auto rounded-xl border px-3.5 py-3 text-[13px] leading-snug shadow-[0_12px_40px_-12px_rgba(0,0,0,0.55)] backdrop-blur-md ${
              item.kind === "error"
                ? "border-ember/35 bg-[#1c1010]/95] text-[#fecaca]"
                : item.kind === "success"
                  ? "border-moss/30 bg-[#0f1a14]/95] text-[#bbf7d0]"
                  : "border-line bg-elevated/95 text-ink-soft"
            }`}
          >
            <div className="flex items-start gap-2">
              <p className="min-w-0 flex-1">{item.message}</p>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="shrink-0 text-[11px] opacity-60 hover:opacity-100"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      toast: () => {},
      error: () => {},
    };
  }
  return ctx;
}

export async function readApiError(
  response: Response,
  fallback = "Something went wrong.",
): Promise<string> {
  const text = await response.text();
  if (!text) return fallback;
  try {
    const json = JSON.parse(text) as { detail?: unknown };
    if (typeof json.detail === "string") return json.detail;
    if (Array.isArray(json.detail)) {
      return json.detail
        .map((d) =>
          typeof d === "object" && d && "msg" in d
            ? String((d as { msg: string }).msg)
            : JSON.stringify(d),
        )
        .join("; ");
    }
  } catch {
  }
  return text.slice(0, 280) || fallback;
}
