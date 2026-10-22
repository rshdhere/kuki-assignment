"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Icon } from "@/components/icon";
import { uploadFiles } from "@/lib/upload";

interface Toast {
  title: string;
  body: string;
  ok: boolean;
  /** In-progress toasts stay up and have no draining timer. */
  sticky?: boolean;
}

const UploadContext = createContext<{
  upload: (files: File[]) => void;
  busy: boolean;
} | null>(null);

export function useUpload() {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error("useUpload must be used inside <UploadProvider>");
  return ctx;
}

const plural = (n: number) => `${n} file${n === 1 ? "" : "s"}`;

/** Runs uploads for the Documents page and shows their progress as a toast. */
export function UploadProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const [toastKey, setToastKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const show = useCallback((next: Toast) => {
    if (timer.current) clearTimeout(timer.current);
    setToastKey((k) => k + 1); // remounts the toast so its animation restarts
    setToast(next);
    if (!next.sticky) timer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const upload = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setBusy(true);
      show({
        title: `Uploading ${plural(files.length)}`,
        body: "Keep this page open until the upload finishes.",
        ok: true,
        sticky: true,
      });
      try {
        const { queued, duplicates, failed } = await uploadFiles(files);
        const [firstFailure] = failed;
        const counts = [
          queued.length && `${plural(queued.length)} queued`,
          duplicates.length &&
            `${duplicates.length} skipped as duplicate${duplicates.length === 1 ? "" : "s"}`,
        ].filter(Boolean);
        if (!firstFailure) {
          show({
            title: counts.join(", "),
            body: queued.length
              ? "Processing starts in the background. You can leave this page."
              : duplicates.length === 1
                ? "Its content is already in this workspace."
                : "Their content is already in this workspace.",
            ok: true,
          });
        } else {
          show({
            title: counts.length
              ? [...counts, `${failed.length} not uploaded`].join(", ")
              : `${plural(failed.length)} not uploaded`,
            body:
              failed.length === 1
                ? `${firstFailure.file}: ${firstFailure.reason}.`
                : failed.map((f) => `${f.file}: ${f.reason}`).join(" · "),
            ok: false,
          });
        }
      } finally {
        setBusy(false);
      }
    },
    [show],
  );

  return (
    <UploadContext.Provider value={{ upload, busy }}>
      {children}
      {toast && (
        <div key={toastKey} className="toast" role="status">
          <Icon
            name={toast.ok ? "check-circle" : "minus-circle"}
            size={18}
            color={toast.ok ? "var(--mark)" : "var(--warn)"}
            style={{ flex: "none", marginTop: 1 }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <b style={{ fontWeight: 500 }}>{toast.title}</b>
            <span>{toast.body}</span>
          </div>
          {!toast.sticky && <i className="t-bar" />}
        </div>
      )}
    </UploadContext.Provider>
  );
}
