"use client";

import { useState } from "react";
import {
  FyGroups,
  FyHero,
  headlineScore,
  readableNote,
} from "@/components/fy-groups";
import { Topbar } from "@/components/topbar";
import { Segmented } from "@/components/segmented";
import { PageHeading } from "@/components/ui";
import { api } from "@/lib/api";
import { docName, fyOf } from "@/lib/format";
import { usePoll } from "@/lib/use-poll";

const METRICS = [
  [null, "Everything"],
  ["electricity", "Electricity"],
  ["water", "Water"],
  ["waste", "Waste"],
] as const;

const range = (fy: string) => {
  const start = Number(fy.slice(0, 4));
  return `1 April ${start} – 31 March ${start + 1}`;
};

const DAY = 86_400_000;
const at = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).getTime();

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
  const [metric, setMetric] = useState<(typeof METRICS)[number][0]>(null);
  const fy = picked ?? options[0] ?? null;

  const summary = usePoll(
    () => (fy ? api.financialYear(fy, metric, []) : Promise.resolve(null)),
    0,
    `${fy}|${metric}`,
  );
  const data = summary.data;
  const hero = data?.groups.length
    ? [...data.groups].sort((a, b) => headlineScore(b) - headlineScore(a))[0]
    : undefined;

  // Timeline from the earliest document to the end of this FY.
  const dated = ready.filter((d) => d.periodStart || d.periodEnd);
  const fyStart = fy ? at(`${fy.slice(0, 4)}-04-01`) : 0;
  const fyEnd = fy ? at(`${Number(fy.slice(0, 4)) + 1}-04-01`) : 0;
  const from = Math.min(
    fyStart,
    ...dated.map((d) => at((d.periodStart ?? d.periodEnd)!)),
  );
  const span = Math.max(DAY, fyEnd - from);
  const x = (t: number) => `${(100 * (t - from)) / span}%`;
  const w = (a: number, b: number) =>
    `${Math.max(1.2, (100 * (b - a)) / span)}%`;

  return (
    <>
      <Topbar crumbs={[{ label: "Financial year" }]} />
      <main className="page">
        <PageHeading
          title={fy ? `FY ${fy}` : "Financial year"}
          lede={
            fy
              ? range(fy)
              : "Once documents are read, their figures are totalled here by Indian financial year (April to March)."
          }
          aside={
            fy && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Segmented
                  label="Financial year"
                  numeric
                  options={[...options]
                    .reverse()
                    .map((y) => ({ value: y, label: y }))}
                  value={fy}
                  onChange={setPicked}
                />
                <Segmented
                  label="Metric"
                  options={METRICS.map(([value, label]) => ({ value, label }))}
                  value={metric}
                  onChange={setMetric}
                />
              </div>
            )
          }
        />

        {summary.error && (
          <p className="muted">
            These totals couldn&apos;t be loaded. Try again in a moment.
          </p>
        )}
        {summary.loading && fy && <p className="muted">Adding up…</p>}
        {data && hero && fy && <FyHero group={hero} fyStart={fy} />}
        {data && <FyGroups summary={data} skip={hero} />}

        {fy && (dated.length > 0 || (data?.notes.length ?? 0) > 0) && (
          <div className="grid-2" style={{ gap: 32 }}>
            {dated.length > 0 && (
              <section aria-label="Document periods vs this year">
                <h2 className="section-h">Document periods vs this year</h2>
                <div style={{ marginTop: 8 }}>
                  {dated.map((d) => {
                    const a = at((d.periodStart ?? d.periodEnd)!);
                    const b = at((d.periodEnd ?? d.periodStart)!) + DAY;
                    const inYear = a < fyEnd && b > fyStart;
                    return (
                      <div
                        key={d.id}
                        className="bt"
                        style={{
                          display: "grid",
                          gridTemplateColumns: "150px 1fr",
                          alignItems: "center",
                          gap: 14,
                          padding: "9px 0",
                          fontSize: 14,
                        }}
                      >
                        <span
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={d.filename}
                        >
                          {docName(d.filename)}
                        </span>
                        <div
                          role="img"
                          aria-label={`${docName(d.filename)}: ${inYear ? "overlaps" : "outside"} FY ${fy}`}
                          style={{ position: "relative", height: 20 }}
                        >
                          <span
                            style={{
                              position: "absolute",
                              inset: "0 auto 0 auto",
                              left: x(fyStart),
                              width: w(fyStart, fyEnd),
                              background: "rgba(255,255,255,.5)",
                              borderRadius: 4,
                            }}
                          />
                          <span
                            style={{
                              position: "absolute",
                              top: 3,
                              height: 14,
                              left: x(a),
                              width: w(a, b),
                              borderRadius: 4,
                              background: inYear ? "var(--mark)" : "#3a3b3e",
                              outline: inYear ? "1.5px solid var(--ink)" : 0,
                              opacity: inYear ? 1 : 0.5,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                  Light band: FY {fy}. Highlighted bars overlap it. Documents
                  from different organisations are never added together.
                </p>
              </section>
            )}
            {(data?.notes.length ?? 0) > 0 && (
              <section aria-label="Assumptions">
                <h2 className="section-h">Assumptions</h2>
                <div style={{ marginTop: 8 }}>
                  {data!.notes.map((n) => (
                    <p
                      key={n}
                      className="bt"
                      style={{ padding: "13px 0", fontSize: 15 }}
                    >
                      {readableNote(n)}
                    </p>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </>
  );
}
