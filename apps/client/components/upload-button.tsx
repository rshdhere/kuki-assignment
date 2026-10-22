"use client";

import { useRef } from "react";
import { Icon } from "@/components/icon";
import { useUpload } from "@/components/upload-provider";
import { ACCEPT } from "@/lib/upload";

/** Primary action on the Documents page. Opens the file picker and uploads the selection. */
export function UploadButton() {
  const { upload, busy } = useUpload();
  const input = useRef<HTMLInputElement>(null);

  return (
    <>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => input.current?.click()}
        disabled={busy}
      >
        <Icon name="upload" className="lift-icon" />
        Upload files
      </button>
      <input
        ref={input}
        type="file"
        multiple
        accept={ACCEPT}
        className="sr"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          upload(Array.from(e.target.files ?? []));
          e.target.value = ""; // so picking the same file again still fires
        }}
      />
    </>
  );
}
