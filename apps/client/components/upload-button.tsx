"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";

/** Primary action on the Documents page. Shows a toast with a draining timer. */
export function UploadButton() {
  const [toastKey, setToastKey] = useState(0);
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    setToastKey((k) => k + 1); // remounts the toast so its animation restarts
    setVisible(true);
    timer.current = setTimeout(() => setVisible(false), 3200);
  };

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={show}>
        <Icon name="upload" className="lift-icon" />
        Upload files
      </button>
      {visible && (
        <div key={toastKey} className="toast" role="status">
          <Icon
            name="check-circle"
            size={18}
            color="var(--mark)"
            style={{ flex: "none", marginTop: 1 }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <b style={{ fontWeight: 500 }}>3 files queued</b>
            <span>
              Processing starts in the background. You can leave this page.
            </span>
          </div>
          <i className="t-bar" />
        </div>
      )}
    </>
  );
}
