import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Topbar } from "@/components/topbar";
import { Badge, CardHead, PageHeading, StatCard } from "@/components/ui";
import { coverage, fy202627Months } from "@/lib/data";

const YEARS = ["2022-23", "2023-24", "2024-25", "2025-26", "2026-27"];
const CURRENT = "2026-27";
// 1 px per 1,000 kWh, so the 220 px plot tops out at 220k.
const PLOT_HEIGHT = 220;

export default function FinancialYearPage() {
  const recorded = fy202627Months.filter((m) => m.kwh !== null);
  const total = recorded.reduce((sum, m) => sum + (m.kwh ?? 0), 0);

  return (
    <>
      <Topbar
        crumbs={[{ label: "Financial year" }]}
        actions={
          <button type="button" className="btn btn-outline">
            Export CSV
          </button>
        }
      />
      <main className="page">
        <PageHeading
          title={`FY ${CURRENT}`}
          lede="1 April 2026 to 31 March 2027"
          aside={
            <nav className="seg" aria-label="Financial year">
              {YEARS.map((y) => (
                <Link
                  key={y}
                  href="/financial-year"
                  className="num"
                  aria-current={y === CURRENT ? "page" : undefined}
                  style={y === "2023-24" ? { color: "var(--muted)" } : undefined}
                >
                  {y}
                </Link>
              ))}
            </nav>
          }
        />

        <section className="grid-stats" aria-label="Totals">
          <StatCard
            label="Electricity"
            value={total.toLocaleString("en-US")}
            unit="kWh"
            foot="Sum of monthly rows, Apr – Dec 2026"
            top={
              <Badge kind="warn">
                {recorded.length} of 12 months
              </Badge>
            }
          />
          <StatCard
            label="Grid supply"
            value="1,154,800"
            unit="kWh"
            foot="62.7% grid · 37.3% renewable"
          >
            <div className="meter" style={{ display: "flex" }}>
              <i style={{ width: "62.7%", borderRadius: 0 }} />
              <i
                style={{
                  width: "37.3%",
                  borderRadius: 0,
                  background: "var(--sage)",
                  animationDelay: "500ms",
                }}
              />
            </div>
          </StatCard>
          <StatCard
            label="Renewable"
            value="687,000"
            unit="kWh"
            foot="Solar and wind, same sheet"
          />
          <StatCard
            label="Water and waste"
            value="No records"
            foot="Water is in FY 2025-26, waste in 2022-23"
            muted
          />
        </section>

        <section className="card pad" aria-label="Monthly electricity" style={{ gap: 16 }}>
          <div className="card-head" style={{ alignItems: "flex-start" }}>
            <CardHead
              title="Monthly electricity"
              desc="kWh · Monthly Summary 2026, F6:F14 · hover a bar for its value"
            />
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 14,
                fontSize: 12,
                color: "var(--text-2)",
                alignItems: "center",
              }}
            >
              <Legend swatch={{ background: "var(--emerald)" }}>Recorded</Legend>
              <Legend swatch={{}} className="stripes">
                Month not over
              </Legend>
              <Legend swatch={{ border: "1px dashed var(--line-2)" }}>
                No document
              </Legend>
            </div>
          </div>
          <div className="scroll">
            <div
              style={{ display: "flex", gap: 8, minWidth: 760, paddingTop: 24 }}
            >
              <div
                className="mono muted"
                style={{
                  position: "relative",
                  width: 40,
                  flex: "none",
                  height: PLOT_HEIGHT,
                  fontSize: 11,
                }}
              >
                {[0, 50, 100, 150, 200].map((k) => (
                  <span
                    key={k}
                    style={{ position: "absolute", right: 0, bottom: k - 7 }}
                  >
                    {k === 0 ? "0" : `${k}k`}
                  </span>
                ))}
              </div>
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div className="bars" role="img" aria-label="Monthly electricity for FY 2026-27: April to December recorded, January to March missing">
                  {fy202627Months.map((m, i) =>
                    m.kwh === null ? (
                      <i key={m.month} className="gap" style={{ height: PLOT_HEIGHT - 1 }} />
                    ) : (
                      <i
                        key={m.month}
                        className={m.open ? "stripes" : undefined}
                        data-v={`${m.kwh.toLocaleString("en-US")}${m.open ? " · open" : ""}`}
                        style={{
                          height: Math.round(m.kwh / 1000),
                          animation: m.open
                            ? `grow 700ms var(--ease-out) ${100 + i * 40}ms both, stripes 1.2s linear infinite`
                            : undefined,
                          animationDelay: m.open ? undefined : `${100 + i * 40}ms`,
                        }}
                      />
                    ),
                  )}
                </div>
                <div className="bar-labels">
                  {fy202627Months.map((m) => (
                    <span key={m.month}>
                      <span
                        style={
                          m.month === "Oct"
                            ? { color: "var(--ink)", fontWeight: 500 }
                            : undefined
                        }
                      >
                        {m.month}
                      </span>
                      <span className="mono" style={{ display: "block", fontSize: 11 }}>
                        {m.kwh === null ? "—" : `${(m.kwh / 1000).toFixed(1)}k`}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="row">
          <section className="card grow" aria-label="Coverage by document" style={{ gap: 0 }}>
            <div style={{ padding: "16px 16px 12px" }}>
              <CardHead
                title="Coverage by document"
                desc="Which uploads fall inside this year"
              />
            </div>
            <div className="scroll bt">
              <table className="tbl" style={{ minWidth: 560 }}>
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Period</th>
                    <th>In this FY</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {coverage.map(([doc, period, inFy, note], i) => (
                    <tr key={doc}>
                      <td className="strong">{doc}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{period}</td>
                      <td className={i === 0 ? undefined : "muted"}>
                        {i === 0 ? <Badge kind="soft">{inFy}</Badge> : inFy}
                      </td>
                      <td className="muted">{note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="card pad rail" aria-label="Assumptions">
            <h2 className="card-h">Assumptions</h2>
            <ol
              style={{
                listStyle: "none",
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: 12,
                fontSize: 13,
                color: "var(--text-2)",
              }}
            >
              {[
                "Totals use the monthly rows. The sheet's own annual row is 1,000 kWh off from its months.",
                "Oct to Dec 2026 have values but aren't over as of 22 Oct 2026. They're counted and flagged.",
                "Bills from different organisations are never added together.",
              ].map((text, i) => (
                <li key={text} style={{ display: "flex", gap: 10 }}>
                  <span className="meta" style={{ paddingTop: 2 }}>
                    0{i + 1}
                  </span>
                  <span>{text}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </main>
    </>
  );
}

function Legend({
  swatch,
  className,
  children,
}: {
  swatch: CSSProperties;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span className={`legend-swatch ${className ?? ""}`} style={swatch} />
      {children}
    </span>
  );
}
