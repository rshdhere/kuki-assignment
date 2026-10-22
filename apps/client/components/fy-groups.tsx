import type { FinancialYearSummary, FyGroup } from "@kuki/types";
import { Badge } from "@/components/ui";
import { docName, num, period, placeText } from "@/lib/format";

const MONTHS = [
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
const PLOT_HEIGHT = 140;

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
function headlineScore(g: FyGroup) {
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

/** One card per document and measure: the headline total, coverage, and the rest folded away. */
export function FyGroups({
  summary,
  compact = false,
}: {
  summary: FinancialYearSummary;
  compact?: boolean;
}) {
  const byDoc = new Map<string, FyGroup[]>();
  for (const g of summary.groups) {
    const key = `${g.document_id}|${g.metric}`;
    byDoc.set(key, [...(byDoc.get(key) ?? []), g]);
  }
  const cards = [...byDoc.values()].map((gs) => {
    const sorted = [...gs].sort((a, b) => headlineScore(b) - headlineScore(a));
    return { main: sorted[0]!, others: sorted.slice(1) };
  });

  return (
    <div className="stack">
      {cards.length === 0 && (
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
            <div className="muted" style={{ fontSize: 13 }}>
              {Object.entries(summary.combined)
                .map(([k, v]) => `${num(v)} ${k}`)
                .join(", ")}
            </div>
          </div>
        </div>
      )}
      {!compact &&
        (summary.notes.length > 0 ||
          summary.documents_without_overlap.length > 0) && (
          <section className="note" aria-label="Good to know">
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div className="strong">Good to know</div>
              <ul
                className="muted"
                style={{ fontSize: 13, paddingLeft: 18, margin: 0 }}
              >
                {summary.notes.map((n) => (
                  <li key={n}>{readableNote(n)}</li>
                ))}
              </ul>
            </div>
          </section>
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
  const values = monthly(g);
  const max = Math.max(1, ...(values ? [...values.values()] : [1]));
  const full = g.months_covered.length === 12;

  return (
    <section
      className="card pad"
      style={{ gap: 16, boxShadow: compact ? "none" : undefined }}
    >
      <div className="card-head" style={{ alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div className="stat-label">
            {METRIC[g.metric] ?? g.metric} in {docName(g.filename)}
          </div>
          <h3 className="section-h">{nameOf(g)}</h3>
          <div className="muted" style={{ fontSize: 13 }}>
            {g.organisation ?? "Organisation not named"}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="stat" style={{ fontSize: 26 }}>
            {num(g.total)}
            <small> {g.unit ?? ""}</small>
          </div>
          <Badge kind={full ? "default" : "warn"}>
            {g.months_covered.length} of 12 months covered
          </Badge>
        </div>
      </div>

      <div
        className="meter"
        aria-label={`${g.coverage_pct}% of the year covered`}
      >
        <i style={{ width: `${g.coverage_pct}%` }} />
      </div>

      {values && !compact && (
        <div>
          <div
            className="bars"
            role="img"
            aria-label={`${nameOf(g)} by month`}
            style={{ height: PLOT_HEIGHT }}
          >
            {MONTHS.map((m) => {
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
                  data-v={num(v)}
                  style={{
                    height: Math.max(
                      2,
                      Math.round((v / max) * (PLOT_HEIGHT - 12)),
                    ),
                  }}
                />
              );
            })}
          </div>
          <div className="bar-labels">
            {MONTHS.map((m) => (
              <span key={m}>{m}</span>
            ))}
          </div>
        </div>
      )}

      {g.months_missing.length > 0 && g.months_missing.length < 12 && (
        <p className="muted" style={{ fontSize: 13 }}>
          No figures for {g.months_missing.join(", ")}.
        </p>
      )}

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
                  <td className="num">
                    {period(r.period_start, r.period_end)}
                  </td>
                  <td className="r num">{num(r.value)}</td>
                  <td className="r num">
                    {num(r.included_value)}
                    {r.prorated && (
                      <div className="muted" style={{ fontSize: 11 }}>
                        {r.overlap_days} of {r.period_days} days
                      </div>
                    )}
                  </td>
                  <td style={{ fontSize: 13 }}>
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
            style={{ fontSize: 12, paddingLeft: 18, margin: "8px 0 0" }}
          >
            {g.excluded.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
      </details>

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
                    style={{ width: "22%", fontSize: 13 }}
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

/** "p.1" or "Sheet!F3" (from the service) back into a locator for display. */
function locatorOf(label: string) {
  const page = /^p\.(\d+)$/.exec(label);
  if (page) return { page: Number(page[1]) };
  const [sheet, cell_range] = label.split("!");
  return { sheet, cell_range: cell_range ?? null };
}

/** Notes start with a file name; show it the way the rest of the page does. */
function readableNote(note: string) {
  return note.replace(
    /^(.+?\.(?:pdf|xlsx|csv)):/i,
    (_, file: string) => `${docName(file)}:`,
  );
}
