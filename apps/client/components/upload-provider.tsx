"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { useToast } from "@/components/toast";
import { uploadFiles } from "@/lib/upload";

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

/** Runs uploads for the Documents page and reports their progress as a toast. */
export function UploadProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const upload = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setBusy(true);
      const id = toast.show({
        title: `Uploading ${plural(files.length)}`,
        body: "Keep this page open until the upload finishes.",
        tone: "loading",
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
          toast.update(id, {
            title: counts.join(", "),
            body: queued.length
              ? "Processing starts in the background. You can leave this page."
              : duplicates.length === 1
                ? "Its content is already in this workspace."
                : "Their content is already in this workspace.",
            tone: "success",
          });
        } else {
          toast.update(id, {
            title: counts.length
              ? [...counts, `${failed.length} not uploaded`].join(", ")
              : `${plural(failed.length)} not uploaded`,
            body:
              failed.length === 1
                ? `${firstFailure.file}: ${firstFailure.reason}.`
                : failed.map((f) => `${f.file}: ${f.reason}`).join(" · "),
            tone: "error",
          });
        }
      } catch {
        toast.update(id, {
          title: "Upload didn't finish",
          body: "KuKi couldn't reach its server. Check your connection and try again.",
          tone: "error",
        });
      } finally {
        setBusy(false);
      }
    },
    [toast],
  );

  return (
    <UploadContext.Provider value={{ upload, busy }}>
      {children}
    </UploadContext.Provider>
  );
}
