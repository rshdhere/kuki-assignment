import type { DocumentSummary } from "@kuki/types";
import { docName, period } from "@/lib/format";

const DAY = 86_400_000;
const at = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
const jan1 = (year: number) => Date.UTC(year, 0, 1);

/**
 * Each document's period on one shared year axis, with the financial year
 * as a band down every row, so it's clear which documents feed the year.
 */
export function PeriodTimeline({
  documents,
  fy,
}: {
  documents: DocumentSummary[];
  fy: string;
}) {
  const fyYear = Number(fy.slice(0, 4));
  const fyStart = Date.UTC(fyYear, 3, 1);
  const fyEnd = Date.UTC(fyYear + 1, 3, 1);

  const rows = documents
    .filter((d) => d.periodStart || d.periodEnd)
    .map((d) => {
      const start = at((d.periodStart ?? d.periodEnd)!);
      const end = at((d.periodEnd ?? d.periodStart)!) + DAY;
      const overlap = Math.max(
        0,
        Math.min(end, fyEnd) - Math.max(start, fyStart),
      );
      return {
        d,
        start,
        end,
        overlap,
        months: Math.max(1, Math.round(overlap / DAY / 30.4)),
      };
    })
    .sort((a, b) => a.start - b.start);

  // From 1 January of the earliest year to just past whichever ends last.
  const firstYear = Math.min(
    fyYear,
    ...rows.map((r) => new Date(r.start).getUTCFullYear()),
  );
  const from = jan1(firstYear);
  const to = Math.max(fyEnd + 45 * DAY, ...rows.map((r) => r.end + 15 * DAY));
  const span = to - from;
  const pct = (t: number) => (100 * (t - from)) / span;
  const years: number[] = [];
  for (let y = firstYear; jan1(y) < to; y++) years.push(y);
  const step = years.length > 8 ? 2 : 1;

  return (
    <section className="card pad" aria-label="Document periods vs this year">
      <div className="card-head">
        <h2 className="section-h">Document periods vs FY {fy}</h2>
        <span style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <span className="legend">
            <i
              style={{
                background: "var(--mark)",
                outline: "1.5px solid var(--ink)",
              }}
            />
            Counts towards FY {fy}
          </span>
          <span className="legend">
            <i style={{ background: "#6b6c6e" }} />
            Outside it
          </span>
        </span>
      </div>

      <div className="ptl">
        {/* Gridlines and the FY band sit behind every row. */}
        <div className="ptl-layer" aria-hidden="true">
          {years.map((y) => (
            <i
              key={y}
              className="ptl-grid"
              style={{ left: `${pct(jan1(y))}%` }}
            />
          ))}
          <span
            className="ptl-band"
            style={{
              left: `${pct(fyStart)}%`,
              width: `${pct(fyEnd) - pct(fyStart)}%`,
            }}
          >
            <b>FY {fy}</b>
          </span>
        </div>

        <div className="ptl-axis" aria-hidden="true">
          <span />
          <div>
            {years.map((y, i) =>
              i % step === 0 ? (
                <span key={y} style={{ left: `${pct(jan1(y))}%` }}>
                  {y}
                </span>
              ) : null,
            )}
          </div>
        </div>

        <ul className="ptl-rows">
          {rows.map(({ d, start, end, overlap, months }) => {
            const inYear = overlap > 0;
            const when = period(d.periodStart, d.periodEnd);
            return (
              <li key={d.id}>
                <span className="ptl-name">
                  <b title={d.filename}>{docName(d.filename)}</b>
                  <small>
                    {when}
                    {" · "}
                    {inYear
                      ? `${months} month${months === 1 ? "" : "s"} in FY`
                      : "outside FY"}
                  </small>
                </span>
                <span className="ptl-track" aria-hidden="true">
                  <i
                    className={inYear ? "in" : undefined}
                    title={when}
                    style={{
                      left: `${pct(start)}%`,
                      width: `max(10px, ${pct(end) - pct(start)}%)`,
                    }}
                  />
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="muted" style={{ fontSize: 13 }}>
        Only the part of a document inside the band is counted. Documents from
        different organisations are never added together.
      </p>
    </section>
  );
}
