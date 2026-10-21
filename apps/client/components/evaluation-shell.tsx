"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/icon";
import { Topbar } from "@/components/topbar";

/** Top bar plus the run strip, which share the "running" state. */
export function EvaluationShell({ children }: { children: ReactNode }) {
  const [running, setRunning] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const run = () => {
    if (timer.current) clearTimeout(timer.current);
    setRunning(true);
    timer.current = setTimeout(() => setRunning(false), 3200);
  };

  return (
    <>
      <Topbar
        crumbs={[{ label: "Evaluation" }]}
        actions={
          <>
            <button type="button" className="btn btn-outline">
              Compare runs
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={run}
              disabled={running}
            >
              {running ? (
                <>
                  <Icon name="loader" size={14} className="spin" />
                  Running
                </>
              ) : (
                <>
                  <Icon name="play" size={14} />
                  Run all cases
                </>
              )}
            </button>
          </>
        }
      />
      <main className="page">
        <div className="head-text">
          <h1 className="title">Evaluation</h1>
          <p className="lede">
            12 cases, each checked by hand against the documents. Every version
            runs the same cases.
          </p>
        </div>
        {running && (
          <div className="runstrip" role="status">
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                gap: 8,
                fontSize: 13,
              }}
            >
              <span className="strong">Running r_03 on 12 cases</span>
              <span className="muted">
                Results replace the placeholders when done
              </span>
            </div>
            <div className="bar indet">
              <i />
            </div>
          </div>
        )}
        {children}
      </main>
    </>
  );
}
