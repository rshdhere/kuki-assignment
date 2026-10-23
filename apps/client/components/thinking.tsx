"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";

/** The stages the answer pipeline runs through, and roughly when each starts.
 *  The request is a single call, so progress is paced by time, not reported. */
const STEPS = [
  { at: 0, label: () => "Picking the passages that match the question" },
  {
    at: 2,
    label: (n: number) => `Reading ${n} document${n === 1 ? "" : "s"}`,
  },
  { at: 12, label: () => "Working out the figures" },
  { at: 24, label: () => "Checking every quote against its source" },
];

const secs = (ms: number) => `${Math.max(1, Math.round(ms / 1000))}s`;

function Steps({ reached, docs }: { reached: number; docs: number }) {
  return (
    <ol className="think-steps">
      {STEPS.slice(0, reached + 1).map((s, i) => {
        const done = i < reached;
        return (
          <li key={i} className={done ? "done" : "active"}>
            <span className="think-dot" aria-hidden="true">
              {done ? <Icon name="check" size={12} strokeWidth={3} /> : <i />}
            </span>
            <span className={done ? undefined : "shimmer"}>
              {s.label(docs)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Live while the answer is being worked out; a one-line summary afterwards. */
export function Thinking({
  docs,
  startedAt,
  tookMs,
}: {
  docs: number;
  startedAt: number;
  tookMs?: number;
}) {
  const [now, setNow] = useState(() => Date.now());
  const running = tookMs === undefined;

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [running]);

  if (!running) {
    return (
      <details className="think think-done">
        <summary>
          <Icon name="chevron-right" size={14} />
          Read {docs} document{docs === 1 ? "" : "s"} in {secs(tookMs)}
        </summary>
        <Steps reached={STEPS.length} docs={docs} />
      </details>
    );
  }

  const elapsed = (now - startedAt) / 1000;
  const reached = STEPS.filter((s) => elapsed >= s.at).length - 1;
  return (
    <div className="think" role="status" aria-live="polite">
      <div className="think-head">
        <span className="shimmer strong">Thinking</span>
        <span className="muted mono">{secs(now - startedAt)}</span>
      </div>
      <Steps reached={reached} docs={docs} />
      {elapsed > 60 && (
        <span className="muted" style={{ fontSize: 14 }}>
          Taking longer than usual. Long spreadsheets can take a while.
        </span>
      )}
    </div>
  );
}
