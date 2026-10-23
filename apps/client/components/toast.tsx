"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Icon } from "@/components/icon";

export type ToastTone = "loading" | "success" | "error" | "info";

export interface ToastInput {
  title: string;
  body?: string;
  tone?: ToastTone;
  /** Milliseconds before it closes on its own. Loading toasts stay until updated. */
  duration?: number;
}

interface ToastItem extends Required<Omit<ToastInput, "body">> {
  id: number;
  body?: string;
  /** Bumped on update so the timer and bar restart. */
  version: number;
  leaving: boolean;
}

interface ToastApi {
  show: (toast: ToastInput) => number;
  update: (id: number, toast: ToastInput) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const DEFAULT_MS: Record<ToastTone, number> = {
  loading: 0,
  success: 4000,
  info: 4000,
  error: 7000,
};
const EXIT_MS = 200;
const MAX = 4;

/** Holds the toast stack for the dashboard and renders it bottom-right. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((all) =>
      all.map((t) => (t.id === id ? { ...t, leaving: true } : t)),
    );
    setTimeout(
      () => setToasts((all) => all.filter((t) => t.id !== id)),
      EXIT_MS,
    );
  }, []);

  const normalise = (t: ToastInput) => {
    const tone = t.tone ?? "info";
    return {
      title: t.title,
      body: t.body,
      tone,
      duration: t.duration ?? DEFAULT_MS[tone],
    };
  };

  const show = useCallback((t: ToastInput) => {
    const id = nextId.current++;
    setToasts((all) =>
      [...all, { id, version: 0, leaving: false, ...normalise(t) }].slice(-MAX),
    );
    return id;
  }, []);

  const update = useCallback((id: number, t: ToastInput) => {
    setToasts((all) =>
      all.map((x) =>
        x.id === id ? { ...x, ...normalise(t), version: x.version + 1 } : x,
      ),
    );
  }, []);

  const api = useMemo(
    () => ({ show, update, dismiss }),
    [show, update, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <section className="toasts" aria-label="Notifications">
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onClose={() => dismiss(t.id)} />
        ))}
      </section>
    </ToastContext.Provider>
  );
}

const ICON = {
  success: "check-circle",
  error: "alert",
  info: "info",
} as const;

function Toast({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  const [paused, setPaused] = useState(false);
  const left = useRef(toast.duration);
  const started = useRef(0);

  // Count down only while not hovered or focused; restart when the toast is updated.
  useEffect(() => {
    left.current = toast.duration;
  }, [toast.version, toast.duration]);
  useEffect(() => {
    if (!toast.duration || paused || toast.leaving) return;
    started.current = Date.now();
    const timer = setTimeout(onClose, left.current);
    return () => {
      clearTimeout(timer);
      left.current -= Date.now() - started.current;
    };
  }, [paused, toast.duration, toast.version, toast.leaving, onClose]);

  return (
    <div
      className="toast"
      data-tone={toast.tone}
      data-leaving={toast.leaving || undefined}
      role={toast.tone === "error" ? "alert" : "status"}
      aria-live={toast.tone === "error" ? "assertive" : "polite"}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className="toast-icon">
        {toast.tone === "loading" ? (
          <Icon name="loader" size={18} className="spin" />
        ) : (
          <Icon
            key={toast.version}
            name={ICON[toast.tone]}
            size={18}
            className="copied"
          />
        )}
      </span>
      <div className="toast-text">
        <b>{toast.title}</b>
        {toast.body && <span>{toast.body}</span>}
      </div>
      <button
        type="button"
        className="toast-close"
        aria-label="Dismiss notification"
        onClick={onClose}
      >
        <Icon name="x" size={14} />
      </button>
      {toast.duration > 0 && (
        <i
          key={toast.version}
          className="toast-bar"
          style={{
            animationDuration: `${toast.duration}ms`,
            animationPlayState: paused ? "paused" : "running",
          }}
        />
      )}
    </div>
  );
}
