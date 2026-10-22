"use client";

import { Fragment, useState } from "react";
import { Icon } from "@/components/icon";
import { Topbar } from "@/components/topbar";
import { MarkLabel, PageHeading, StatCard } from "@/components/ui";
import { api, type EvalCaseResult, type EvalRun, type Mark } from "@/lib/api";
import { usePoll } from "@/lib/use-poll";

const CHECKS = [
  ["answer", "Gives the right answer"],
  ["evidence", "Points to a source that really says it"],
  ["calculation", "Does the sums correctly"],
  ["uncertainty", "Says what's missing or unclear"],
] as const;
const RANK: Record<Mark, number> = { error: 0, fail: 0, partial: 1, pass: 2 };

const points = (run: EvalRun) => run.summary.pass + 0.5 * run.summary.partial;

export function EvaluationView() {
  const evals = usePoll(api.evaluations);
  const [open, setOpen] = useState<string | null>(null);
  const runs = evals.data?.runs ?? {};
  const first = runs[evals.data?.comparison?.before ?? "baseline"] ?? null;
  const second = runs[evals.data?.comparison?.after ?? "improved"] ?? null;
  const shown = [first, second].filter((r): r is EvalRun => r !== null);
  const names = second
    ? ["First version", "Improved version"]
    : ["Latest version"];
  const secondCases = new Map(second?.cases.map((c) => [c.id, c]) ?? []);
  const total = first?.summary.cases ?? 0;

  const change = (c: EvalCaseResult) => {
    const b = secondCases.get(c.id);
    if (!second || !b) return undefined;
    const d = RANK[b.score.mark] - RANK[c.score.mark];
    return d > 0 ? "fixed" : d < 0 ? "regressed" : undefined;
  };
  const fixed = first?.cases.filter((c) => change(c) === "fixed").length ?? 0;
  const worse =
    first?.cases.filter((c) => change(c) === "regressed").length ?? 0;

  return (
    <>
      <Topbar crumbs={[{ label: "Accuracy" }]} />
      <main className="page">
        <PageHeading
          title="Accuracy"
          lede={`To test KuKi, we asked it ${total || "a set of"} questions about these documents whose answers we had worked out by hand. Each answer is checked in four ways, listed below.`}
        />

        {evals.error && (
          <p className="muted">
            The test results couldn&apos;t be loaded. Try again in a moment.
          </p>
        )}
        {!evals.loading && !first && !evals.error && (
          <div role="note" className="note">
            <Icon name="info" style={{ flex: "none", marginTop: 2 }} />
            <div>No test results yet.</div>
          </div>
        )}

        {first && (
          <>
            <section className="grid-stats" aria-label="Scores">
              {shown.map((run, i) => (
                <StatCard
                  key={run.pipeline}
                  label={names[i]!}
                  value={String(points(run))}
                  unit={`of ${run.summary.cases}`}
                  foot={`${run.summary.pass} right, ${run.summary.partial} partly right, ${run.summary.fail + run.summary.error} wrong`}
                />
              ))}
              {second && (
                <StatCard
                  label="What changed"
                  value={`${fixed} fixed`}
                  foot={worse ? `${worse} got worse` : "Nothing got worse"}
                />
              )}
              {second && (
                <div className="card pad" style={{ gap: 6 }}>
                  <span className="stat-label">The improvement</span>
                  <p style={{ fontSize: 13, color: "var(--text-2)" }}>
                    KuKi now checks spreadsheet sources cell by cell and
                    two-column pages line by line, so correct sources are no
                    longer flagged as unconfirmed.
                  </p>
                </div>
              )}
            </section>

            <section className="card" aria-label="Checks">
              <div style={{ padding: "16px 16px 12px" }}>
                <h2 className="section-h">How each answer is checked</h2>
                <p className="section-d">
                  Questions passing each check, out of the questions it applies
                  to.
                </p>
              </div>
              <div className="bt">
                <table className="tbl tbl-fixed">
                  <colgroup>
                    <col style={{ width: second ? "50%" : "70%" }} />
                    {shown.map((r) => (
                      <col
                        key={r.pipeline}
                        style={{ width: second ? "25%" : "30%" }}
                      />
                    ))}
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Check</th>
                      {names.map((n) => (
                        <th key={n} className="r">
                          {n}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {CHECKS.map(([key, label]) => (
                      <tr key={key}>
                        <td>{label}</td>
                        {shown.map((r) => {
                          const c = r.summary.checks[key];
                          return (
                            <td key={r.pipeline} className="r num">
                              {c ? `${c.passed} of ${c.applicable}` : "—"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="card" aria-label="Questions">
              <div style={{ padding: "16px 16px 12px" }}>
                <h2 className="section-h">The questions</h2>
                <p className="section-d">
                  Select a question to see KuKi&apos;s answer and where the
                  right answer is in the documents.
                </p>
              </div>
              <div className="scroll bt">
                <table className="tbl tbl-fixed" style={{ minWidth: 640 }}>
                  <colgroup>
                    <col style={{ width: second ? "58%" : "75%" }} />
                    {shown.map((r) => (
                      <col
                        key={r.pipeline}
                        style={{ width: second ? "21%" : "25%" }}
                      />
                    ))}
                  </colgroup>
                  <thead>
                    <tr>
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
                          <tr className={isOpen ? "selected" : undefined}>
                            <td>
                              <button
                                type="button"
                                className="rowbtn"
                                aria-expanded={isOpen}
                                onClick={() => setOpen(isOpen ? null : c.id)}
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
                                  "—"
                                )}
                              </td>
                            )}
                          </tr>
                          {isOpen && (
                            <tr className="selected">
                              <td colSpan={1 + shown.length}>
                                <div
                                  className="stack"
                                  style={{
                                    gap: 12,
                                    fontSize: 13,
                                    padding: "4px 0",
                                  }}
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
