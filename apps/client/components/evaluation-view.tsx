"use client";

import { Fragment, useState } from "react";
import { Icon, type IconName } from "@/components/icon";
import { Gauge } from "@/components/gauge";
import { Topbar } from "@/components/topbar";
import { MarkLabel, PageHeading } from "@/components/ui";
import { api, type EvalCaseResult, type EvalRun, type Mark } from "@/lib/api";
import { usePoll } from "@/lib/use-poll";

const CHECKS = [
  ["answer", "Answer correct"],
  ["evidence", "Evidence supports"],
  ["calculation", "Calculation"],
  ["uncertainty", "Gaps stated"],
] as const;
const RANK: Record<Mark, number> = { error: 0, fail: 0, partial: 1, pass: 2 };
const GLYPH: Record<Mark, IconName> = {
  pass: "check",
  partial: "minus-circle",
  fail: "x",
  error: "x",
};
const BAR_HEIGHT = 160;
/** Case colours on the dark card, passes first round the dial. */
const DIAL: Record<Mark, string> = {
  pass: "#9fe0bd",
  partial: "#f2c46b",
  fail: "#ff9d9d",
  error: "#ff9d9d",
};

const points = (run: EvalRun) => run.summary.pass + 0.5 * run.summary.partial;
const rate = (run: EvalRun, key: string) => {
  const c = run.summary.checks[key];
  return c && c.applicable ? c.passed / c.applicable : null;
};
const pct = (r: number | null) =>
  r === null ? "–" : `${Math.round(100 * r)}%`;

export function EvaluationView() {
  const evals = usePoll(api.evaluations);
  const [open, setOpen] = useState<string | null>(null);
  const runs = evals.data?.runs ?? {};
  const before = evals.data?.comparison?.before ?? "baseline";
  const after = evals.data?.comparison?.after ?? "improved";
  const first = runs[before] ?? null;
  const second = runs[after] ?? null;
  const shown = [first, second].filter((r): r is EvalRun => r !== null);
  const names = second ? [before, after] : [before];
  const secondCases = new Map(second?.cases.map((c) => [c.id, c]) ?? []);
  const total = first?.summary.cases ?? 0;

  const change = (c: EvalCaseResult) => {
    const b = secondCases.get(c.id);
    if (!second || !b) return undefined;
    const d = RANK[b.score.mark] - RANK[c.score.mark];
    return d > 0 ? "fixed" : d < 0 ? "regressed" : undefined;
  };
  const ids = (pred: (c: EvalCaseResult) => boolean) =>
    first?.cases.filter(pred).map((c) => c.id) ?? [];
  const fixed = ids((c) => change(c) === "fixed");
  const worse = ids((c) => change(c) === "regressed");
  const partial = ids(
    (c) => (secondCases.get(c.id) ?? c).score.mark === "partial",
  );
  const delta = first && second ? points(second) - points(first) : 0;

  const toggle = (id: string) => {
    setOpen(open === id ? null : id);
    if (open !== id)
      requestAnimationFrame(() =>
        document
          .getElementById(`case-${id}`)
          ?.scrollIntoView({ block: "nearest", behavior: "smooth" }),
      );
  };

  return (
    <>
      <Topbar
        crumbs={[{ label: "Evaluation" }]}
        actions={
          first && (
            <span className="mono muted">
              {first.model} · ran{" "}
              {new Date((second ?? first).ran_at).toLocaleDateString("en-GB")}
            </span>
          )
        }
      />
      <main className="page">
        <PageHeading
          title="Evaluation"
          lede={`${total || "A set of"} questions with answers worked out by hand from the documents. Each answer is checked four ways.`}
        />

        {evals.error && (
          <p className="muted">
            The test results couldn&apos;t be loaded. Try again in a moment.
          </p>
        )}
        {!evals.loading && !first && !evals.error && (
          <div role="note" className="note">
            <Icon name="info" style={{ flex: "none", marginTop: 3 }} />
            <div>No test results yet.</div>
          </div>
        )}

        {first && (
          <>
            <section
              aria-label="Scores"
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 22,
                flexWrap: "wrap",
              }}
            >
              {shown.map((run, i) => (
                <Fragment key={run.pipeline}>
                  {i > 0 && (
                    <Icon
                      name="arrow-right"
                      size={26}
                      className="muted"
                      style={{ alignSelf: "center" }}
                    />
                  )}
                  <span>
                    <span className="muted" style={{ fontSize: 14 }}>
                      {names[i]}
                    </span>
                    <br />
                    <span className="stat" style={{ fontSize: 44 }}>
                      {points(run)}
                    </span>
                    <span className="muted"> / {run.summary.cases}</span>
                  </span>
                </Fragment>
              ))}
              {second && (
                <span
                  className={`badge ${delta >= 0 ? "badge-ok" : "badge-bad"}`}
                >
                  {delta >= 0 ? "+" : ""}
                  {delta.toFixed(1)}
                </span>
              )}
              {second && (
                <span className="muted" style={{ fontSize: 15 }}>
                  {fixed.length} fixed · {worse.length} regressed ·{" "}
                  {partial.length} still partial
                </span>
              )}
            </section>

            <section className="card pad" aria-label="Results by question">
              <div className="scroll">
                <div
                  style={{
                    minWidth: 60 + first.cases.length * 44,
                    display: "flex",
                    flexDirection: "column",
                    gap: 5,
                  }}
                >
                  <div
                    className="hm mono muted"
                    style={{
                      ["--n" as string]: first.cases.length,
                      fontSize: 12,
                      textAlign: "center",
                    }}
                    aria-hidden="true"
                  >
                    <span />
                    {first.cases.map((c) => (
                      <span key={c.id}>{c.id}</span>
                    ))}
                  </div>
                  {shown.map((run, i) => {
                    const byId = new Map(run.cases.map((c) => [c.id, c]));
                    return (
                      <div
                        key={run.pipeline}
                        className="hm"
                        style={{ ["--n" as string]: first.cases.length }}
                      >
                        <span
                          className="mono"
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {names[i]}
                        </span>
                        {first.cases.map((c) => {
                          const x = byId.get(c.id);
                          if (!x) return <span key={c.id} />;
                          const changed = i === 1 && change(c) !== undefined;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              className={`hm-c ${x.score.mark}${changed ? " changed" : ""}`}
                              aria-label={`${c.id} ${names[i]}: ${x.score.mark}${changed ? `, ${change(c)}` : ""}`}
                              title={c.question}
                              onClick={() => toggle(c.id)}
                            >
                              <Icon
                                name={GLYPH[x.score.mark]}
                                size={15}
                                strokeWidth={3}
                              />
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
              <p className="muted" style={{ fontSize: 14 }}>
                Green pass · amber partial · red fail
                {second && " · outlined cells changed between runs"} · select a
                cell to open the question
              </p>
            </section>

            <div className="grid-2" style={{ alignItems: "stretch" }}>
              <section
                className="card pad"
                aria-label="Score by check"
                style={{ gap: 16 }}
              >
                <div className="card-head">
                  <h2 className="section-h">Score by check</h2>
                  <span style={{ display: "flex", gap: 14, fontSize: 13 }}>
                    {shown.map((r, i) => (
                      <span key={r.pipeline} className="legend">
                        <i
                          style={{
                            background:
                              i === 0 ? "rgba(255,255,255,.85)" : "var(--dark)",
                            border: i === 0 ? "1px solid rgba(0,0,0,.2)" : 0,
                          }}
                        />
                        {names[i]}
                      </span>
                    ))}
                  </span>
                </div>
                <div
                  className="vbars"
                  role="img"
                  aria-label={CHECKS.map(
                    ([k, label]) =>
                      `${label} ${shown.map((r) => pct(rate(r, k))).join(" to ")}`,
                  ).join(", ")}
                >
                  {CHECKS.map(([key]) => (
                    <div key={key}>
                      {shown.map((r, i) => (
                        <i
                          key={r.pipeline}
                          style={{
                            height: Math.max(
                              2,
                              (rate(r, key) ?? 0) * BAR_HEIGHT,
                            ),
                            background:
                              i === 0 ? "rgba(255,255,255,.85)" : "var(--dark)",
                          }}
                        />
                      ))}
                    </div>
                  ))}
                </div>
                <div
                  className="muted"
                  style={{ display: "flex", fontSize: 13, textAlign: "center" }}
                >
                  {CHECKS.map(([key, label]) => (
                    <span key={key} style={{ flex: 1 }}>
                      {label}
                      <br />
                      <span className="num">
                        {shown.map((r) => pct(rate(r, key))).join(" → ")}
                      </span>
                    </span>
                  ))}
                </div>
              </section>

              {second && (
                <section
                  className="card card-dark pad"
                  aria-label="What changed"
                  style={{ fontSize: 15, lineHeight: 1.55 }}
                >
                  <h2 style={{ fontSize: 18, fontWeight: 600 }}>
                    What changed
                  </h2>
                  <p style={{ color: "#e6e6e6" }}>
                    KuKi now checks spreadsheet sources cell by cell and
                    two-column pages line by line, so correct sources are no
                    longer flagged as unconfirmed.
                  </p>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 24,
                      flexWrap: "wrap",
                      marginTop: "auto",
                    }}
                  >
                    <Gauge
                      size={150}
                      segments={[...second.cases]
                        .sort((a, b) => RANK[b.score.mark] - RANK[a.score.mark])
                        .map((c) => DIAL[c.score.mark])}
                      value={points(second)}
                      mark={points(first)}
                      decimals={points(second) % 1 ? 1 : 0}
                      center={`/${second.summary.cases}`}
                      label={`${names[1]} scores ${points(second)} of ${second.summary.cases}, up from ${points(first)}`}
                    />
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      <p>
                        <b style={{ color: "#9fe0bd" }}>Fixed</b>{" "}
                        {fixed.join(", ") || "none"}
                      </p>
                      <p>
                        <b style={{ color: "#ff9d9d" }}>Regressed</b>{" "}
                        {worse.join(", ") || "none"}
                      </p>
                      <p>
                        <b style={{ color: "#f2c46b" }}>Still partial</b>{" "}
                        {partial.join(", ") || "none"}
                      </p>
                      <span className="muted" style={{ fontSize: 13 }}>
                        Grey tick: {names[0]} at {points(first)}
                      </span>
                    </div>
                  </div>
                </section>
              )}
            </div>

            <section
              className="card"
              aria-label="Questions"
              style={{ overflow: "hidden" }}
            >
              <div className="scroll">
                <table className="tbl tbl-fixed" style={{ minWidth: 680 }}>
                  <colgroup>
                    <col style={{ width: 72 }} />
                    <col />
                    {shown.map((r) => (
                      <col key={r.pipeline} style={{ width: 150 }} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Case</th>
                      <th>Question</th>
                      {names.map((n) => (
                        <th key={n}>{n}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {first.cases.map((c) => {
                      const other = secondCases.get(c.id);
                      const isOpen = open === c.id;
                      return (
                        <Fragment key={c.id}>
                          <tr
                            id={`case-${c.id}`}
                            className={isOpen ? "selected" : undefined}
                          >
                            <td className="mono muted">{c.id}</td>
                            <td>
                              <button
                                type="button"
                                className="rowbtn"
                                aria-expanded={isOpen}
                                onClick={() => toggle(c.id)}
                              >
                                {c.question}
                              </button>
                            </td>
                            <td>
                              <MarkLabel mark={c.score.mark} />
                            </td>
                            {second && (
                              <td>
                                {other ? (
                                  <MarkLabel
                                    mark={other.score.mark}
                                    change={change(c)}
                                  />
                                ) : (
                                  "–"
                                )}
                              </td>
                            )}
                          </tr>
                          {isOpen && (
                            <tr className="selected">
                              <td />
                              <td colSpan={1 + shown.length}>
                                <div
                                  className="stack"
                                  style={{ gap: 12, fontSize: 14 }}
                                >
                                  <div>
                                    <div className="strong">
                                      Where the right answer is
                                    </div>
                                    <div className="muted">{c.source}</div>
                                  </div>
                                  {[c, other].map(
                                    (x, i) =>
                                      x && (
                                        <div key={names[i]}>
                                          <div className="strong">
                                            {names[i]}
                                          </div>
                                          <p style={{ whiteSpace: "pre-wrap" }}>
                                            {x.answer?.answer ??
                                              "No answer was given."}
                                          </p>
                                        </div>
                                      ),
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
}
