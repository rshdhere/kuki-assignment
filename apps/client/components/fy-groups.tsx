import type { FinancialYearSummary, FyGroup } from "@kuki/types";
import { Gauge } from "@/components/gauge";
import { Badge } from "@/components/ui";
import { docName, num, period, placeText } from "@/lib/format";

export const MONTHS = [
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
  "Jan",
  "Feb",
  "Mar",
];
const PLOT_HEIGHT = 220;

const METRIC: Record<string, string> = {
  electricity: "Electricity",
  water: "Water",
  waste: "Waste",
  fuel: "Fuel",
  emissions: "Emissions",
  cost: "Money",
};

/** A readable name: the extracted series, or the figure's own label. */
const nameOf = (g: FyGroup) => {
  const first = g.records[0];
  return g.series && g.series !== first?.fact_key
    ? g.series
    : (first?.label ?? g.metric);
};

/** The figure a person would expect as "the total": overall consumption first. */
export function headlineScore(g: FyGroup) {
  const name = nameOf(g).toLowerCase();
  let score = g.months_covered.length * 10 + g.records.length;
  if (
    /total consumption|units consumed|^consumption|net consumption|total \(|total$/.test(
      name,
    )
  )
    score += 1000;
  if (
    /quarter|season|renewable|solar|wind|grid|tod|peak|reactive|lag|lead/.test(
      name,
    )
  )
    score -= 500;
  return score;
}

/** Included value per FY month, when every record sits inside one month. */
function monthly(group: FyGroup) {
  const values = new Map<string, number>();
  for (const r of group.records) {
    if (r.period_days > 31) return null;
    const start = new Date(`${r.period_start}T00:00:00Z`);
    const m = MONTHS[(start.getUTCMonth() + 9) % 12]!;
    values.set(m, (values.get(m) ?? 0) + r.included_value);
  }
  return values.size > 1 ? values : null;
}

const short = (v: number) =>
  v >= 1e6
    ? `${(v / 1e6).toFixed(2)}M`
    : v >= 1e3
      ? `${(v / 1e3).toFixed(1)}k`
      : num(v);

type MonthState = "covered" | "open" | "missing";

/** Each FY month: covered by a document, not over yet, or missing. */
function monthStates(g: FyGroup, fyStart: string, today = new Date()) {
  const startYear = Number(fyStart.slice(0, 4));
  return MONTHS.map((m, i): MonthState => {
    if (g.months_covered.includes(m)) return "covered";
    const monthEnd = new Date(Date.UTC(startYear, 3 + i + 1, 1));
    return monthEnd > today ? "open" : "missing";
  });
}

/** Twelve arc segments, April at the top, coloured by month state. */
function CoverageDial({ states }: { states: MonthState[] }) {
  const counts = {
    covered: states.filter((s) => s === "covered").length,
    open: states.filter((s) => s === "open").length,
    missing: states.filter((s) => s === "missing").length,
  };
  const stroke: Record<MonthState, string> = {
    covered: "#efefef",
    open: "rgba(255,255,255,.4)",
    missing: "rgba(255,255,255,.12)",
  };
  return (
    <section
      className="card card-dark pad"
      aria-label="Coverage"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 22,
        flexWrap: "wrap",
      }}
    >
      <Gauge
        segments={states.map((st) => stroke[st])}
        value={counts.covered}
        center="/12"
        top="APR"
        bottom="OCT"
        label={`${counts.covered} months covered, ${counts.open} not over yet, ${counts.missing} with no document`}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          fontSize: 14,
        }}
      >
        <b style={{ fontSize: 17 }}>Coverage</b>
        <span className="legend" style={{ fontSize: 14 }}>
          <i style={{ background: "#efefef" }} />
          {counts.covered} months covered
        </span>
        {counts.open > 0 && (
          <span className="legend" style={{ fontSize: 14 }}>
            <i style={{ background: "rgba(255,255,255,.4)" }} />
            {counts.open} not over yet
          </span>
        )}
        <span className="legend" style={{ fontSize: 14 }}>
          <i style={{ border: "1.5px solid rgba(255,255,255,.3)" }} />
          {counts.missing} no document
        </span>
      </div>
    </section>
  );
}

/** The year's headline figure: big total, coverage dial and monthly bars. */
export function FyHero({
  group: g,
  fyStart,
}: {
  group: FyGroup;
  fyStart: string;
}) {
  const states = monthStates(g, fyStart);
  const values = monthly(g);
  const max = Math.max(1, ...(values ? [...values.values()] : [1]));
  const full = g.months_covered.length === 12;

  return (
    <>
      <div className="grid-2" style={{ alignItems: "stretch" }}>
        <section
          className="card pad"
          style={{ justifyContent: "space-between", gap: 18 }}
          aria-label="Headline total"
        >
          <div className="card-head">
            <span className="muted">
              {METRIC[g.metric] ?? g.metric} · {nameOf(g)} ·{" "}
              {g.organisation ?? "organisation not stated"}
            </span>
            <Badge kind={full ? "ok" : "warn"}>
              {g.months_covered.length} of 12 months
            </Badge>
          </div>
          <span
            className="num"
            style={{
              fontSize: "clamp(40px, 5vw, 60px)",
              fontWeight: 600,
              letterSpacing: "-0.03em",
              lineHeight: 1,
              overflowWrap: "anywhere",
            }}
          >
            {num(g.total)}{" "}
            <span className="muted" style={{ fontSize: 22, fontWeight: 400 }}>
              {g.unit ?? ""}
            </span>
          </span>
          <div
            className="meter"
            aria-label={`${g.coverage_pct}% of the year covered`}
          >
            <i style={{ width: `${g.coverage_pct}%` }} />
          </div>
          <span className="muted" style={{ fontSize: 14 }}>
            From {docName(g.filename)} · {g.coverage_pct}% of the year covered
          </span>
        </section>
        <CoverageDial states={states} />
      </div>

      {values && (
        <section className="card pad" aria-label={`${nameOf(g)} per month`}>
          <div className="card-head">
            <h2 className="section-h">{nameOf(g)} per month</h2>
            <span className="muted" style={{ fontSize: 13 }}>
              Solid: recorded · dashed: no figure
            </span>
          </div>
          <div className="scroll chart-scroll">
            <div style={{ minWidth: 640 }}>
              <div
                className="bars"
                role="img"
                aria-label={MONTHS.map((m) => {
                  const v = values.get(m);
                  return `${m} ${v === undefined ? "no figure" : num(v)}`;
                }).join(", ")}
                style={{ height: PLOT_HEIGHT }}
              >
                {MONTHS.map((m, i) => {
                  const v = values.get(m);
                  return v === undefined ? (
                    <i
                      key={m}
                      className="gap"
                      style={{ height: PLOT_HEIGHT - 1 }}
                    />
                  ) : (
                    <i
                      key={m}
                      data-v={`${num(v)} ${g.unit ?? ""}`}
                      style={{
                        height: Math.max(
                          3,
                          Math.round((v / max) * (PLOT_HEIGHT - 16)),
                        ),
                        animationDelay: `${i * 30}ms`,
                      }}
                    />
                  );
                })}
              </div>
              <div className="bar-labels" aria-hidden="true">
                {MONTHS.map((m) => {
                  const v = values.get(m);
                  return (
                    <span
                      key={m}
                      className={v === undefined ? "muted" : undefined}
                    >
                      {m}
                      <small>{v === undefined ? "–" : short(v)}</small>
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
          <span className="mono muted" style={{ fontSize: 11 }}>
            Bars start at 0 · tallest = {num(max)} {g.unit ?? ""}
          </span>
        </section>
      )}
    </>
  );
}

/** One card per document and measure: the headline total, coverage, and the rest folded away. */
export function FyGroups({
  summary,
  compact = false,
  skip,
}: {
  summary: FinancialYearSummary;
  compact?: boolean;
  /** A group already shown as the hero. */
  skip?: FyGroup;
}) {
  const byDoc = new Map<string, FyGroup[]>();
  for (const g of summary.groups) {
    const key = `${g.document_id}|${g.metric}`;
    byDoc.set(key, [...(byDoc.get(key) ?? []), g]);
  }
  const cards = [...byDoc.values()]
    .map((gs) => {
      const sorted = [...gs].sort(
        (a, b) => headlineScore(b) - headlineScore(a),
      );
      return { main: sorted[0]!, others: sorted.slice(1) };
    })
    .filter(({ main }) => main !== skip);

  return (
    <div className="stack">
      {cards.length === 0 && !skip && (
        <p className="muted">
          None of the selected documents have figures for this year.
        </p>
      )}
      {cards.map(({ main, others }) => (
        <FyCard
          key={`${main.document_id}-${main.metric}`}
          group={main}
          others={others}
          compact={compact}
        />
      ))}
      {summary.combined && (
        <div className="note">
          <div>
            <div className="strong">Combined for the year</div>
            <div className="muted" style={{ fontSize: 14 }}>
              {Object.entries(summary.combined)
                .map(([k, v]) => `${num(v)} ${k}`)
                .join(", ")}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FyCard({
  group: g,
  others,
  compact,
}: {
  group: FyGroup;
  others: FyGroup[];
  compact: boolean;
}) {
  const full = g.months_covered.length === 12;

  return (
    <section className="card pad">
      <div className="card-head" style={{ alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div className="stat-label">
            {METRIC[g.metric] ?? g.metric} in {docName(g.filename)}
          </div>
          <h3 className="section-h">{nameOf(g)}</h3>
          <div className="muted" style={{ fontSize: 14 }}>
            {g.organisation ?? "Organisation not named"}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="stat" style={{ fontSize: 28 }}>
            {num(g.total)}
            <small> {g.unit ?? ""}</small>
          </div>
          <Badge kind={full ? "ok" : "warn"}>
            {g.months_covered.length} of 12 months
          </Badge>
        </div>
      </div>

      <div
        className="meter"
        aria-label={`${g.coverage_pct}% of the year covered`}
      >
        <i style={{ width: `${g.coverage_pct}%` }} />
      </div>

      {g.months_missing.length > 0 && g.months_missing.length < 12 && (
        <p className="muted" style={{ fontSize: 14 }}>
          No figures for {g.months_missing.join(", ")}.
        </p>
      )}

      <FiguresUsed group={g} />

      {others.length > 0 && !compact && (
        <details className="disc">
          <summary>Also in this document ({others.length})</summary>
          <table className="tbl tbl-fixed" style={{ marginTop: 8 }}>
            <tbody>
              {others.map((o) => (
                <tr key={`${o.series}-${o.unit}`}>
                  <td>{nameOf(o)}</td>
                  <td className="r num" style={{ width: "30%" }}>
                    {num(o.total)} {o.unit ?? ""}
                  </td>
                  <td
                    className="r muted"
                    style={{ width: "22%", fontSize: 14 }}
                  >
                    {o.months_covered.length} of 12 months
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </section>
  );
}

export function FiguresUsed({ group: g }: { group: FyGroup }) {
  return (
    <details className="disc">
      <summary>Show the figures used ({g.records.length})</summary>
      <div className="scroll" style={{ marginTop: 12 }}>
        <table className="tbl tbl-fixed" style={{ minWidth: 520 }}>
          <colgroup>
            <col style={{ width: "34%" }} />
            <col style={{ width: "22%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "24%" }} />
          </colgroup>
          <thead>
            <tr>
              <th>Period</th>
              <th className="r">As printed</th>
              <th className="r">Counted</th>
              <th>Found on</th>
            </tr>
          </thead>
          <tbody>
            {g.records.map((r) => (
              <tr key={`${r.fact_key}-${r.period_start}`}>
                <td className="num">{period(r.period_start, r.period_end)}</td>
                <td className="r num">{num(r.value)}</td>
                <td className="r num">
                  {num(r.included_value)}
                  {r.prorated && (
                    <div className="muted" style={{ fontSize: 12 }}>
                      {r.overlap_days} of {r.period_days} days
                    </div>
                  )}
                </td>
                <td className="mono muted">
                  {placeText(locatorOf(r.locator_label))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {g.excluded.length > 0 && (
        <ul
          className="muted"
          style={{ fontSize: 13, paddingLeft: 18, margin: "8px 0 0" }}
        >
          {g.excluded.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </details>
  );
}

/** "p.1" or "Sheet!F3" (from the service) back into a locator for display. */
function locatorOf(label: string) {
  const page = /^p\.(\d+)$/.exec(label);
  if (page) return { page: Number(page[1]) };
  const [sheet, cell_range] = label.split("!");
  return { sheet, cell_range: cell_range ?? null };
}

/** Notes start with a file name; show it the way the rest of the page does. */
export function readableNote(note: string) {
  return note.replace(
    /^(.+?\.(?:pdf|xlsx|csv)):/i,
    (_, file: string) => `${docName(file)}:`,
  );
}
