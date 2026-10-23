"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { useUpload } from "@/components/upload-provider";
import { ACCEPT } from "@/lib/upload";

/** Drag-and-drop target that doubles as a file picker. */
export function UploadDropzone() {
  const { upload } = useUpload();
  const [over, setOver] = useState(false);

  return (
    <label
      className={over ? "drop over" : "drop"}
      htmlFor="upload"
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        upload(Array.from(e.dataTransfer.files));
      }}
    >
      <span className="drop-icon">
        <Icon name="arrow-up" size={20} color="var(--ink)" />
      </span>
      <b style={{ fontWeight: 600 }}>Drop files here</b>
      <span className="muted" style={{ fontSize: 14 }}>
        PDF, XLSX or CSV, up to 25 MB each. Files already in KuKi are skipped.
      </span>
      <span className="btn btn-sm">Browse files</span>
      <input
        id="upload"
        type="file"
        multiple
        accept={ACCEPT}
        className="sr"
        onChange={(e) => {
          upload(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
    </label>
  );
}
