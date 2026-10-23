"use client";

import { useState } from "react";
import {
  FyGroups,
  FyHero,
  headlineScore,
  readableNote,
} from "@/components/fy-groups";
import { Topbar } from "@/components/topbar";
import { PeriodTimeline } from "@/components/period-timeline";
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

        {fy && <PeriodTimeline documents={ready} fy={fy} />}

        {(data?.notes.length ?? 0) > 0 && (
          <section
            className="card pad"
            aria-label="Assumptions"
            style={{ gap: 0 }}
          >
            <h2 className="section-h" style={{ marginBottom: 6 }}>
              Assumptions
            </h2>
            {data!.notes.map((n) => (
              <p
                key={n}
                className="bt"
                style={{ padding: "12px 0", fontSize: 15 }}
              >
                {readableNote(n)}
              </p>
            ))}
          </section>
        )}
      </main>
    </>
  );
}
