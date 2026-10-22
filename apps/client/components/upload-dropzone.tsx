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
        <Icon name="upload" size={18} color="var(--emerald)" />
      </span>
      <span
        style={{
          flex: "1 1 260px",
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <span style={{ fontWeight: 500 }}>
          Drop files here, or browse to upload
        </span>
        <span className="muted" style={{ fontSize: 13 }}>
          PDF, Excel (.xlsx) or CSV, up to 25 MB each. You can add several at
          once.
        </span>
      </span>
      <span className="btn btn-outline">Browse files</span>
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
