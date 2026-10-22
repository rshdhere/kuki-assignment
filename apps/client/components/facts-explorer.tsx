"use client";

import type { Fact } from "@kuki/types";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { Badge, OriginBadge } from "@/components/ui";
import type { SegmentView } from "@/lib/api";
import { factGroups, period, placeText } from "@/lib/format";
import { findHighlight, findSegment } from "@/lib/highlight";

type Filter = "all" | "reported" | "calculated";

const FILTERS: [Filter, string][] = [
  ["all", "All"],
  ["reported", "From the document"],
  ["calculated", "Worked out by KuKi"],
];

/**
 * Facts grouped under plain headings, with the source panel beside them.
 * Picking a fact shows the original text with the fact highlighted.
 */
export function FactsExplorer({
  facts,
  segments,
  issues,
}: {
  facts: Fact[];
  segments: SegmentView[];
  issues: string[];
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [pickedId, setPickedId] = useState<number | null>(facts[0]?.id ?? null);

  const q = query.trim().toLowerCase();
  const visible = facts.filter(
    (f) =>
      (filter === "all" || f.origin === filter) &&
      (!q || `${f.label} ${f.valueText}`.toLowerCase().includes(q)),
  );
  const current = facts.find((f) => f.id === pickedId) ?? visible[0];
  const known = new Set(factGroups.flatMap((g) => g.categories));
  const groups = factGroups
    .map((g) => ({
      ...g,
      facts: visible.filter((f) =>
        g.categories.includes(known.has(f.category) ? f.category : "other"),
      ),
    }))
    .filter((g) => g.facts.length > 0);

  return (
    <div className="split">
      <div className="stack">
        {issues.length > 0 && <Issues issues={issues} />}

        <div className="card-head">
          <div className="seg" role="group" aria-label="Show">
            {FILTERS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <label htmlFor="fact-search" className="sr">
            Find a fact
          </label>
          <input
            id="fact-search"
            type="search"
            className="field"
            placeholder="Find a fact…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {groups.length === 0 && <p className="muted">No facts match.</p>}
        {groups.map((g) => (
          <section key={g.title} className="card" aria-label={g.title}>
            <div className="card-head" style={{ padding: "14px 16px" }}>
              <h2 className="section-h">{g.title}</h2>
              <span className="muted" style={{ fontSize: 13 }}>
                {g.facts.length}
              </span>
            </div>
            <div className="bt">
              <table className="tbl tbl-fixed">
                <colgroup>
                  <col style={{ width: "42%" }} />
                  <col style={{ width: "38%" }} />
                  <col style={{ width: "20%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Value</th>
                    <th>Found on</th>
                  </tr>
                </thead>
                <tbody>
                  {g.facts.map((f) => (
                    <tr
                      key={f.id}
                      className={f.id === current?.id ? "selected" : undefined}
                      onClick={() => setPickedId(f.id)}
                      style={{ cursor: "pointer" }}
                    >
                      <td>
                        <button
                          type="button"
                          className="rowbtn"
                          aria-pressed={f.id === current?.id}
                          onClick={() => setPickedId(f.id)}
                        >
                          {f.label}
                        </button>
                        {f.periodStart && (
                          <div className="muted" style={{ fontSize: 12 }}>
                            {period(f.periodStart, f.periodEnd)}
                          </div>
                        )}
                      </td>
                      <td className="num">
                        {f.valueText}
                        {f.origin === "calculated" && (
                          <div style={{ marginTop: 4 }}>
                            <OriginBadge origin="calculated" />
                          </div>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: 13 }}>
                          {placeText(f.locator)}
                        </span>
                        {f.origin === "reported" && !f.verified && (
                          <div style={{ marginTop: 4 }}>
                            <Badge kind="warn">Check</Badge>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>

      <div className="stack sticky">
        {current && <SourcePanel fact={current} segments={segments} />}
      </div>
    </div>
  );
}

function Issues({ issues }: { issues: string[] }) {
  const [open, setOpen] = useState(false);
  const shown = open ? issues : issues.slice(0, 2);
  return (
    <div role="note" className="alert">
      <Icon
        name="alert"
        color="var(--warn)"
        style={{ flex: "none", marginTop: 2 }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          minWidth: 0,
        }}
      >
        <div className="alert-title">
          Worth double-checking in this document
        </div>
        <ul className="alert-body" style={{ margin: 0, paddingLeft: 18 }}>
          {shown.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
        {issues.length > 2 && (
          <button
            type="button"
            className="rowbtn"
            style={{ fontSize: 13, fontWeight: 500 }}
            onClick={() => setOpen(!open)}
          >
            {open ? "Show fewer" : `Show all ${issues.length}`}
          </button>
        )}
      </div>
    </div>
  );
}

function SourcePanel({
  fact,
  segments,
}: {
  fact: Fact;
  segments: SegmentView[];
}) {
  const segment = findSegment(fact, segments);
  const highlight =
    segment && fact.origin === "reported"
      ? findHighlight(segment.text, fact)
      : null;
  const range = highlight?.range ?? null;
  const markRef = useRef<HTMLElement>(null);
  const boxRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    // Scroll only the text box, never the page.
    const box = boxRef.current;
    const mark = markRef.current;
    if (!box) return;
    box.scrollTo({
      top: mark ? mark.offsetTop - box.clientHeight / 2 : 0,
      behavior: "smooth",
    });
  }, [fact.id]);

  return (
    <section className="card pad" aria-label="Source">
      <div className="card-head">
        <h2 className="section-h">Where it comes from</h2>
        <span className="muted" style={{ fontSize: 13 }}>
          {placeText(fact.locator)}
        </span>
      </div>

      <div>
        <div className="muted" style={{ fontSize: 13 }}>
          {fact.label}
        </div>
        <div
          className="stat"
          style={{ fontSize: 22, overflowWrap: "anywhere" }}
        >
          {fact.valueText}
        </div>
      </div>

      {fact.origin === "calculated" ? (
        <p style={{ fontSize: 13, color: "var(--text-2)" }}>
          This isn&apos;t printed in the document. KuKi worked it out:{" "}
          {fact.derivation ?? "from the figures above"}.
        </p>
      ) : (
        <span className="status" style={{ fontSize: 13, whiteSpace: "normal" }}>
          <Icon
            name={fact.verified ? "check-circle" : "alert"}
            size={15}
            color={fact.verified ? "var(--ok)" : "var(--warn)"}
            style={{ flex: "none" }}
          />
          {fact.verified
            ? `Checked: this appears ${fact.locator.page ? `on page ${fact.locator.page}` : `in ${placeText(fact.locator)}`}.`
            : "KuKi couldn't confirm this in the text. Check the original document."}
        </span>
      )}

      {fact.note && fact.origin === "reported" && (
        <p className="muted" style={{ fontSize: 13 }}>
          Note: {fact.note}
        </p>
      )}

      {segment && !segment.scanned && (
        <>
          <pre
            ref={boxRef}
            className="source-text"
            style={{ position: "relative" }}
          >
            {range ? (
              <>
                {segment.text.slice(0, range[0])}
                <mark ref={markRef} className="hl-inline">
                  {segment.text.slice(range[0], range[1])}
                </mark>
                {segment.text.slice(range[1])}
              </>
            ) : (
              segment.text
            )}
          </pre>
          <span className="muted" style={{ fontSize: 12 }}>
            {highlight?.valueOnly
              ? "Text from the document. The value is highlighted; its label is printed nearby in the original."
              : range
                ? "Text from the document, with the fact highlighted."
                : "Text from the document."}
          </span>
        </>
      )}
      {segment?.scanned && (
        <p className="muted" style={{ fontSize: 13 }}>
          This page is a scanned image, so its text can&apos;t be shown here.
        </p>
      )}
    </section>
  );
}
