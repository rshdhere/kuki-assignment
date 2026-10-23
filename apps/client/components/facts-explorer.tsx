"use client";

import type { Fact } from "@kuki/types";
import { Fragment, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { Segmented } from "@/components/segmented";
import { Badge, Verdict } from "@/components/ui";
import type { SegmentView } from "@/lib/api";
import { factGroups, period, placeText } from "@/lib/format";
import { findHighlight, findSegment } from "@/lib/highlight";

type Filter = "all" | "reported" | "calculated";

const FILTERS: [Filter, string][] = [
  ["all", "All"],
  ["reported", "Reported"],
  ["calculated", "Calculated"],
];

const share = (n: number, of: number) => `${of ? (100 * n) / of : 0}%`;

/** How a fact was checked, in the words of the Check column. */
function CheckText({ fact }: { fact: Fact }) {
  if (fact.origin === "calculated") return <Verdict ok>Recomputed</Verdict>;
  return (
    <Verdict ok={fact.verified}>
      {fact.verified ? "Found" : "Not confirmed"}
    </Verdict>
  );
}

/**
 * Facts in one table under plain group headings, with the source beside them.
 * Picking a fact shows the original text with the fact highlighted.
 */
export function FactsExplorer({
  facts,
  segments,
  issues,
  summary,
  about,
}: {
  facts: Fact[];
  segments: SegmentView[];
  issues: string[];
  summary: string | null;
  about: [string, string][];
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

  const reported = facts.filter((f) => f.origin === "reported");
  const found = reported.filter((f) => f.verified).length;
  const unconfirmed = reported.length - found;
  const calculated = facts.length - reported.length;

  return (
    <>
      {issues.length > 0 && <Issues issues={issues} />}

      <div className="split">
        <section
          className="card"
          aria-label="Facts"
          style={{ overflow: "hidden" }}
        >
          <div
            style={{
              padding: "18px 20px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div className="card-head">
              <h2 className="section-h">
                {facts.length} fact{facts.length === 1 ? "" : "s"}
              </h2>
              <span style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                <span className="legend">
                  <i style={{ background: "var(--ok)" }} />
                  Found at source {found}
                </span>
                {unconfirmed > 0 && (
                  <span className="legend">
                    <i style={{ background: "var(--warn)" }} />
                    Not confirmed {unconfirmed}
                  </span>
                )}
                <span className="legend">
                  <i style={{ background: "var(--calc)" }} />
                  Calculated {calculated}
                </span>
              </span>
            </div>
            <div
              className="split-bar"
              role="img"
              aria-label={`${found} found at source, ${unconfirmed} not confirmed, ${calculated} calculated`}
              style={{ height: 8 }}
            >
              {found > 0 && (
                <i
                  style={{
                    width: share(found, facts.length),
                    background: "var(--ok)",
                  }}
                />
              )}
              {unconfirmed > 0 && (
                <i
                  style={{
                    width: share(unconfirmed, facts.length),
                    background: "var(--warn)",
                  }}
                />
              )}
              {calculated > 0 && (
                <i
                  style={{
                    width: share(calculated, facts.length),
                    background: "var(--calc)",
                  }}
                />
              )}
            </div>
            <div className="card-head">
              <Segmented
                label="Show"
                options={FILTERS.map(([value, label]) => ({ value, label }))}
                value={filter}
                onChange={setFilter}
              />
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
          </div>

          <div className="scroll">
            <table className="tbl tbl-fixed" style={{ minWidth: 640 }}>
              <colgroup>
                <col style={{ width: "30%" }} />
                <col style={{ width: "26%" }} />
                <col style={{ width: 160 }} />
                <col style={{ width: "22%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Value</th>
                  <th>Check</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {groups.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">
                      No facts match.
                    </td>
                  </tr>
                )}
                {groups.map((g) => (
                  <Fragment key={g.title}>
                    <tr className="dim">
                      <td
                        colSpan={4}
                        style={{
                          paddingTop: 10,
                          paddingBottom: 10,
                          fontSize: 13,
                          background: "rgba(0,0,0,.03)",
                        }}
                      >
                        {g.title} · {g.facts.length}
                      </td>
                    </tr>
                    {g.facts.map((f) => {
                      const picked = f.id === current?.id;
                      return (
                        <tr
                          key={f.id}
                          className={picked ? "selected" : undefined}
                          onClick={() => setPickedId(f.id)}
                          style={{ cursor: "pointer" }}
                        >
                          <td>
                            <button
                              type="button"
                              className="rowbtn"
                              aria-pressed={picked}
                              onClick={() => setPickedId(f.id)}
                              style={{ fontWeight: picked ? 600 : 400 }}
                            >
                              {f.label}
                            </button>
                            {f.origin === "calculated" && (
                              <span style={{ marginLeft: 6 }}>
                                <Badge kind="calc">Calculated</Badge>
                              </span>
                            )}
                            {f.periodStart && (
                              <div className="muted" style={{ fontSize: 13 }}>
                                {period(f.periodStart, f.periodEnd)}
                              </div>
                            )}
                          </td>
                          <td className="num" style={{ fontWeight: 500 }}>
                            {f.valueText}
                          </td>
                          <td style={{ fontSize: 14 }}>
                            <CheckText fact={f} />
                          </td>
                          <td className="mono muted">
                            {f.origin === "calculated"
                              ? (f.derivation ?? "From the figures above")
                              : placeText(f.locator)}
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="stack sticky">
          {current && <SourcePanel fact={current} segments={segments} />}
          <section className="card pad" aria-label="About this document">
            <h2 className="section-h">Read from the page</h2>
            {summary && (
              <p style={{ fontSize: 15, lineHeight: 1.55 }}>{summary}</p>
            )}
            <dl
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: "10px 16px",
                fontSize: 14,
              }}
            >
              {about.map(([k, v]) => (
                <Fragment key={k}>
                  <dt className="muted">{k}</dt>
                  <dd style={{ overflowWrap: "anywhere" }}>{v}</dd>
                </Fragment>
              ))}
            </dl>
          </section>
        </div>
      </div>
    </>
  );
}

function Issues({ issues }: { issues: string[] }) {
  const [open, setOpen] = useState(false);
  const shown = open ? issues : issues.slice(0, 2);
  return (
    <section role="note" className="alert" aria-label="Checks that failed">
      <Icon
        name="alert"
        color="var(--warn-ink)"
        style={{ flex: "none", marginTop: 3 }}
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
          {issues.length === 1
            ? "1 check failed in this document"
            : `${issues.length} checks failed in this document`}
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
            style={{ fontSize: 14, fontWeight: 600, color: "#5a3700" }}
            onClick={() => setOpen(!open)}
          >
            {open ? "Show fewer" : `Show all ${issues.length}`}
          </button>
        )}
      </div>
    </section>
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
        <h2 className="section-h">
          Source · {placeText(fact.locator).toLowerCase()}
        </h2>
      </div>

      <div>
        <div className="muted" style={{ fontSize: 14 }}>
          {fact.label}
        </div>
        <div
          className="stat"
          style={{ fontSize: 24, overflowWrap: "anywhere" }}
        >
          {fact.valueText}
        </div>
      </div>

      {segment && !segment.scanned && (
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
      )}

      {fact.origin === "calculated" ? (
        <p style={{ fontSize: 14 }}>
          Not printed in the document. KuKi worked it out:{" "}
          {fact.derivation ?? "from the figures above"}.
        </p>
      ) : (
        <span className="muted" style={{ fontSize: 14 }}>
          {fact.verified
            ? highlight?.valueOnly
              ? "The value is highlighted; its label is printed nearby in the original."
              : `Found ${fact.locator.page ? `on page ${fact.locator.page}` : `in ${placeText(fact.locator)}`}.`
            : "KuKi couldn't confirm this in the text. Check the original document."}
        </span>
      )}

      {fact.note && fact.origin === "reported" && (
        <span className="muted" style={{ fontSize: 14 }}>
          {fact.note}
        </span>
      )}
      {segment?.scanned && (
        <p className="muted" style={{ fontSize: 14 }}>
          This page is a scanned image, so its text can&apos;t be shown here.
        </p>
      )}
    </section>
  );
}
