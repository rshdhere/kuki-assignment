"use client";

import { useState } from "react";
import { FyGroups } from "@/components/fy-groups";
import { Topbar } from "@/components/topbar";
import { Badge, PageHeading } from "@/components/ui";
import { api } from "@/lib/api";
import { docName, fyOf, period } from "@/lib/format";
import { usePoll } from "@/lib/use-poll";

const METRICS = [
  [null, "Everything"],
  ["electricity", "Electricity"],
  ["water", "Water"],
  ["waste", "Waste"],
] as const;

const range = (fy: string) => {
  const start = Number(fy.slice(0, 4));
  return `1 April ${start} to 31 March ${start + 1}`;
};

export function FinancialYearView() {
  const docs = usePoll(api.documents);
  const ready = (docs.data ?? []).filter((d) => d.status === "succeeded");

  // Every financial year that some document's period touches, newest first.
  const years = new Set<string>();
  for (const d of ready) {
    for (const y of [fyOf(d.periodStart), fyOf(d.periodEnd)])
      if (y) years.add(y);
  }
  const options = [...years].sort().reverse();
  const [picked, setPicked] = useState<string | null>(null);
  const [metric, setMetric] = useState<string | null>(null);
  const fy = picked ?? options[0] ?? null;

  const summary = usePoll(
    () => (fy ? api.financialYear(fy, metric, []) : Promise.resolve(null)),
    0,
    `${fy}|${metric}`,
  );

  return (
    <>
      <Topbar crumbs={[{ label: "Financial year" }]} />
      <main className="page">
        <PageHeading
          title={fy ? `Financial year ${fy}` : "Financial year"}
          lede={
            fy
              ? `${range(fy)}. Totals add up only figures printed in your documents, and show how much of the year they cover.`
              : "Once documents are read, their figures are totalled here by Indian financial year (April to March)."
          }
        />

        {fy && (
          <div className="card-head">
            <div className="seg" role="group" aria-label="Show">
              {METRICS.map(([value, label]) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={metric === value}
                  onClick={() => setMetric(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <nav className="seg" aria-label="Financial year">
              {options.map((y) => (
                <button
                  key={y}
                  type="button"
                  className="num"
                  aria-pressed={y === fy}
                  onClick={() => setPicked(y)}
                >
                  {y}
                </button>
              ))}
            </nav>
          </div>
        )}

        {summary.error && (
          <p className="muted">
            These totals couldn&apos;t be loaded. Try again in a moment.
          </p>
        )}
        {summary.loading && fy && <p className="muted">Adding up…</p>}
        {summary.data && <FyGroups summary={summary.data} />}

        {ready.length > 0 && (
          <section className="card" aria-label="Documents by year">
            <div style={{ padding: "16px 16px 12px" }}>
              <h2 className="section-h">Your documents by financial year</h2>
              <p className="section-d">
                Documents from different organisations are never added together.
              </p>
            </div>
            <div className="scroll bt">
              <table className="tbl tbl-fixed" style={{ minWidth: 640 }}>
                <colgroup>
                  <col style={{ width: "34%" }} />
                  <col style={{ width: "28%" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "18%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Organisation</th>
                    <th>Period</th>
                    <th>Financial year</th>
                  </tr>
                </thead>
                <tbody>
                  {ready.map((d) => {
                    const a = fyOf(d.periodStart);
                    const b = fyOf(d.periodEnd);
                    const label =
                      a && b && a !== b ? `${a} to ${b}` : (a ?? b ?? "—");
                    const inYear = fy && (a === fy || b === fy);
                    return (
                      <tr key={d.id}>
                        <td className="strong">{docName(d.filename)}</td>
                        <td className={d.organisation ? undefined : "muted"}>
                          {d.organisation ?? "Not named"}
                        </td>
                        <td className="num">
                          {d.periodStart || d.periodEnd
                            ? period(d.periodStart, d.periodEnd)
                            : "—"}
                        </td>
                        <td>
                          {inYear ? (
                            <Badge kind="soft">{label}</Badge>
                          ) : (
                            <span className="muted">{label}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
