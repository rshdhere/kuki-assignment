import Link from "next/link";
import { CopyAnswer } from "@/components/copy-answer";
import { Icon } from "@/components/icon";
import { Topbar } from "@/components/topbar";
import { Badge, CardHead, OriginBadge } from "@/components/ui";
import {
  earlierAnswers,
  scopeDocuments,
  workbookSources,
  workbookTotals,
} from "@/lib/data";

const ANSWER =
  "No. The workbook reports three different annual totals for 2026: 2,426,123 kWh summed from F3:F14, 2,425,123 kWh in F16, 2,427,123 kWh in Quarterly Summary G7.";

function Cite({ n }: { n: number }) {
  return (
    <a className="cite" href={`#src-${n}`}>
      {n}
    </a>
  );
}

export default function AskPage() {
  return (
    <>
      <Topbar
        crumbs={[{ label: "Ask" }]}
        actions={
          <button type="button" className="btn btn-outline">
            <Icon name="plus" />
            New question
          </button>
        }
      />
      <main className="page page-row">
        <h1 className="sr">Ask</h1>
        <div
          style={{
            flex: "999 1 540px",
            minWidth: 0,
            maxWidth: 800,
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 6,
            }}
          >
            <div className="bubble">
              Do the workbook&apos;s monthly values and annual summaries agree?
            </div>
            <span
              className="muted"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 12,
              }}
            >
              <Icon name="doc" size={12} />
              Annual Electricity Consumption.xlsx
            </span>
          </div>

          <article aria-label="Answer" style={{ display: "flex", gap: 12 }}>
            <span
              className="logo"
              style={{ width: 28, height: 28, borderRadius: 6, fontSize: 12 }}
            >
              <span>K</span>
            </span>
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <Badge kind="warn">
                  <Icon name="alert" size={12} />
                  Inconsistent
                </Badge>
                <span className="muted" style={{ fontSize: 13 }}>
                  5 sources · 2 calculations · every citation checked
                </span>
              </div>
              <h2 style={{ fontSize: 18, lineHeight: 1.4, fontWeight: 600 }}>
                No. The workbook reports three different annual totals for
                2026.
              </h2>
              <p style={{ color: "var(--text-2)", maxWidth: "68ch" }}>
                The twelve monthly rows add up to{" "}
                <b className="mark" style={{ fontWeight: 600, color: "var(--ink)" }}>
                  2,426,123 kWh
                </b>
                <Cite n={1} />. The monthly sheet&apos;s annual row is 1,000 kWh
                lower
                <Cite n={2} />, and the quarterly sheet is 1,000 kWh higher
                <Cite n={3} />. Each gap comes from a single cell: the grid
                column total
                <Cite n={4} /> and Q1 solar
                <Cite n={5} />.
              </p>

              <div className="card" style={{ boxShadow: "none" }}>
                <div className="scroll">
                  <table className="tbl" style={{ minWidth: 520 }}>
                    <thead>
                      <tr>
                        <th>Annual total</th>
                        <th className="r">kWh</th>
                        <th>Origin</th>
                        <th>Cell</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workbookTotals.map((t) => (
                        <tr key={t.cell}>
                          <td>{t.label}</td>
                          <td
                            className="r num"
                            style={{
                              fontWeight:
                                t.origin === "Calculated" ? 600 : undefined,
                            }}
                          >
                            {t.kwh}
                          </td>
                          <td>
                            <OriginBadge origin={t.origin} />
                          </td>
                          <td className="meta" style={{ color: "var(--text-2)" }}>
                            {t.cell}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <details className="disc" open>
                <summary>
                  <Icon name="chevron-right" size={14} />
                  How it was calculated
                </summary>
                <pre className="code">{`sum(F3:F14)                   2,426,123
F16 − sum                        −1,000
Quarterly!G7 − sum               +1,000
sum(B3:B14) − B16  grid          +1,000
sum(C3:C5) − Quarterly!D2  Q1    −1,000`}</pre>
              </details>

              <section
                aria-label="Sources"
                style={{ display: "flex", flexDirection: "column", gap: 8 }}
              >
                <h3 className="muted" style={{ fontSize: 13, fontWeight: 500 }}>
                  Sources
                </h3>
                <div className="card" style={{ boxShadow: "none" }}>
                  {workbookSources.map(([sheet, cell, value], i) => (
                    <Link
                      key={`${sheet}-${cell}`}
                      id={`src-${i + 1}`}
                      className="src"
                      href="/facts"
                    >
                      <span className="src-n">{i + 1}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        {sheet}{" "}
                        <span className="meta" style={{ color: "var(--text-2)" }}>
                          {cell}
                        </span>
                      </span>
                      <span className="muted num" style={{ fontSize: 13 }}>
                        {value}
                      </span>
                      <Icon name="chevron-right" size={14} className="go" />
                    </Link>
                  ))}
                </div>
              </section>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                }}
                className="muted"
              >
                <CopyAnswer text={ANSWER} />
                <span>
                  Not concluded: which total is correct. The workbook
                  doesn&apos;t explain the gaps.
                </span>
              </div>
            </div>
          </article>

          <form className="card composer">
            <label htmlFor="ask" className="sr">
              Ask a question
            </label>
            <textarea
              id="ask"
              rows={2}
              placeholder="Ask about consumption, amounts, policies or a financial year…"
            />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button type="button" className="btn btn-outline btn-sm">
                <Icon name="doc" size={13} />1 document
              </button>
              <button type="button" className="btn btn-outline btn-sm">
                <Icon name="calendar" size={13} />
                Any FY
              </button>
              <button type="submit" className="send" aria-label="Send">
                <Icon name="arrow-up" />
              </button>
            </div>
          </form>
        </div>

        <div className="rail" style={{ maxWidth: 360 }}>
          <section className="card pad" aria-label="Documents in scope">
            <CardHead
              title="Documents in scope"
              desc="Answers only use what's ticked"
            />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                fontSize: 13,
              }}
            >
              {scopeDocuments.map((d, i) => (
                <div
                  key={d}
                  style={{ display: "flex", alignItems: "center", gap: 8 }}
                >
                  <input
                    id={`scope-${i}`}
                    type="checkbox"
                    className="check"
                    defaultChecked={i === 0}
                  />
                  <label htmlFor={`scope-${i}`} style={{ cursor: "pointer" }}>
                    {d}
                  </label>
                </div>
              ))}
            </div>
          </section>
          <section className="card pad" aria-label="Earlier answers" style={{ gap: 6 }}>
            <h2 className="card-h" style={{ marginBottom: 6 }}>
              Earlier answers
            </h2>
            {earlierAnswers.map((a) => (
              <a key={a.question} className="earlier" href="#">
                <span style={{ fontSize: 13, fontWeight: 500 }}>
                  {a.question}
                </span>
                <span
                  className="muted"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                  }}
                >
                  {a.ok && <Icon name="check" size={12} color="var(--ok)" />}
                  {a.summary}
                </span>
              </a>
            ))}
          </section>
        </div>
      </main>
    </>
  );
}
