"use client";

import { useState, type ReactNode } from "react";
import { Icon } from "@/components/icon";
import { CardHead, OriginBadge } from "@/components/ui";
import type { Fact } from "@/lib/data";

type Filter = "all" | "Reported" | "Calculated";

/**
 * Facts table plus the source preview. Picking a fact moves the highlighter
 * to the line it was read from, or explains that it was calculated.
 */
export function FactsExplorer({
  facts,
  details,
}: {
  facts: Fact[];
  details: ReactNode;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [picked, setPicked] = useState(1);
  const [flip, setFlip] = useState(false); // alternates the class so the sweep replays

  const counts = {
    all: facts.length,
    Reported: facts.filter((f) => f.origin === "Reported").length,
    Calculated: facts.filter((f) => f.origin === "Calculated").length,
  };
  const visible = facts
    .map((fact, index) => ({ fact, index }))
    .filter(({ fact }) => filter === "all" || fact.origin === filter);
  const current = facts[picked] ?? facts[0];

  const pick = (index: number) => {
    setPicked(index);
    setFlip((f) => !f);
  };

  return (
    <div className="row" style={{ gap: 20 }}>
      <div className="grow">
        <div role="alert" className="alert">
          <Icon
            name="alert"
            color="var(--warn)"
            style={{ flex: "none", marginTop: 2 }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div className="alert-title">
              Payable amount doesn&apos;t reconcile
            </div>
            <div className="alert-body">
              Current bill plus previous outstanding is ₹6,32,025.48. The bill
              asks for ₹6,31,510.00. The bill doesn&apos;t itemise the ₹515.48
              gap.
            </div>
          </div>
        </div>

        <section className="card" aria-label="Facts">
          <div className="card-head" style={{ padding: "14px 16px" }}>
            <CardHead
              title="Facts"
              desc="Pick a fact to see where it was read."
            />
            <div className="seg" role="group" aria-label="Filter by origin">
              {(["all", "Reported", "Calculated"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={filter === f}
                  onClick={() => setFilter(f)}
                >
                  {f === "all" ? "All" : f}
                  <span className="muted" style={{ marginLeft: 6 }}>
                    {counts[f]}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="scroll bt">
            <table className="tbl" style={{ minWidth: 620 }}>
              <thead>
                <tr>
                  <th>Field</th>
                  <th className="r">Value</th>
                  <th>Origin</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(({ fact, index }) => (
                  <tr
                    key={fact.field}
                    style={
                      index === picked
                        ? { background: "var(--mark-soft)" }
                        : undefined
                    }
                  >
                    <td>
                      <button
                        type="button"
                        className="rowbtn"
                        style={fact.strong ? { fontWeight: 500 } : undefined}
                        aria-pressed={index === picked}
                        onClick={() => pick(index)}
                      >
                        {fact.field}
                      </button>
                    </td>
                    <td
                      className="r num"
                      style={{
                        whiteSpace: "nowrap",
                        fontWeight: fact.strong ? 600 : undefined,
                      }}
                    >
                      {fact.value}
                    </td>
                    <td>
                      <OriginBadge origin={fact.origin} />
                    </td>
                    <td>
                      {fact.page && (
                        <span className="meta" style={{ color: "var(--text-2)" }}>
                          {fact.page}{" "}
                        </span>
                      )}
                      <span className="muted">{fact.note}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="rail" style={{ maxWidth: 340 }}>
        {details}
        <section className="card pad" aria-label="Source">
          <div className="card-head">
            <h2 className="card-h">Source</h2>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 13,
              }}
              className="muted"
            >
              <button
                type="button"
                className="icon-btn"
                aria-label="Previous page"
                disabled
              >
                <Icon name="chevron-left" size={14} />
              </button>
              <span className="num" style={{ padding: "0 4px" }}>
                1 / 2
              </span>
              <button type="button" className="icon-btn" aria-label="Next page">
                <Icon name="chevron-right" size={14} />
              </button>
            </div>
          </div>
          <div className="pdf">
            <div className="pdf-page">
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div
                  className="pdf-line"
                  style={{ width: "40%", height: 7, background: "var(--line)" }}
                />
                <div
                  className="pdf-line"
                  style={{ width: "22%", height: 7, background: "var(--line)" }}
                />
              </div>
              <div className="pdf-line" style={{ width: "58%" }} />
              <div className="pdf-line" style={{ width: "50%" }} />
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  marginTop: 6,
                }}
              >
                <div
                  className="pdf-line"
                  style={{ width: "22%", flex: "none" }}
                />
                {current.sourceLine ? (
                  <span className={`hl ${flip ? "b" : "a"}`} style={{ flex: 1 }}>
                    {current.sourceLine}
                  </span>
                ) : (
                  <span className="meta" style={{ flex: 1 }}>
                    Not on the page. Calculated from {current.derivation}.
                  </span>
                )}
              </div>
              <div className="pdf-line" style={{ width: "64%" }} />
              <div className="pdf-line" style={{ width: "46%" }} />
              <div className="pdf-line" style={{ width: "70%" }} />
              <div className="pdf-line" style={{ width: "36%" }} />
            </div>
          </div>
          <span className="muted" style={{ fontSize: 12 }}>
            {current.sourceLine
              ? `Highlighted where "${current.field}" was read`
              : `"${current.field}" is calculated, so there is nothing to highlight`}
          </span>
        </section>
      </div>
    </div>
  );
}
