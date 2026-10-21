"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";

export function CopyAnswer({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard can be refused; still confirm the press.
    }
    if (timer.current) clearTimeout(timer.current);
    setCopied(true);
    timer.current = setTimeout(() => setCopied(false), 1600);
  };

  return (
    <button
      type="button"
      className="btn btn-outline btn-sm"
      onClick={copy}
      aria-live="polite"
    >
      {copied ? (
        <>
          <Icon name="check" size={14} color="var(--ok)" className="copied" />
          Copied
        </>
      ) : (
        <>
          <Icon name="copy" size={14} />
          Copy answer
        </>
      )}
    </button>
  );
}
