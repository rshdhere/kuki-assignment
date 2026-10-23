import type { AnswerRecord, DocumentSummary } from "@kuki/types";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { CopyAnswer } from "@/components/copy-answer";
import { FyGroups } from "@/components/fy-groups";
import { Icon } from "@/components/icon";
import { Badge, OriginBadge, Verdict } from "@/components/ui";
import { docName, num, placeText, statusLabel } from "@/lib/format";

/** Turns "[E1]" references in the answer into links to the numbered sources. */
function withCitations(text: string, ids: Set<string>): ReactNode[] {
  return text.split(/(\[E\d+\])/g).map((part, i) => {
    const id = /^\[(E\d+)\]$/.exec(part)?.[1];
    if (!id || !ids.has(id)) return <Fragment key={i}>{part}</Fragment>;
    return (
      <a
        key={i}
        className="cite"
        href={`#src-${id}`}
        aria-label={`Source ${id.slice(1)}`}
      >
        [{id.slice(1)}]
      </a>
    );
  });
}

/** The first sentence becomes the headline when the answer runs long. */
function splitLead(text: string): [string, string] {
  const m = /^(.{20,220}?[.?!])(\s+[\s\S]+)$/.exec(text.trim());
  return m && text.length > 160 ? [m[1]!, m[2]!.trim()] : [text.trim(), ""];
}

const TONE: Record<string, "ok" | "warn"> = {
  answered: "ok",
  partial: "warn",
  conflicting_evidence: "warn",
  insufficient_evidence: "warn",
};

export function AnswerCard({
  record,
  documents,
}: {
  record: AnswerRecord;
  documents: DocumentSummary[];
}) {
  const a = record.answer;
  const evidenceIds = new Set(a.evidence.map((e) => e.id));
  const used = record.documentIds.filter((id) =>
    documents.some((d) => d.id === id),
  ).length;
  const docCount = used || record.documentIds.length;
  const allFound = a.evidence.length > 0 && a.evidence.every((e) => e.verified);
  const allMatch =
    a.calculations.length > 0 && a.calculations.every((c) => c.matches);
  const [lead, body] = splitLead(a.answer);

  return (
    <article aria-label="Answer" className="stack" style={{ gap: 24 }}>
      <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <Badge kind={TONE[a.status] ?? "default"}>
            {statusLabel(a.status)}
          </Badge>
          <span className="muted" style={{ fontSize: 14, flex: 1 }}>
            {[
              `${a.evidence.length} source${a.evidence.length === 1 ? "" : "s"}`,
              allFound && "all quotes found at source",
              allMatch && "calculations re-run",
              `${docCount} document${docCount === 1 ? "" : "s"} searched`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
          <CopyAnswer text={a.answer} />
        </div>
        <p className="muted" style={{ fontSize: 15 }}>
          {record.question}
        </p>
        <h2 className="answer-lead">{withCitations(lead, evidenceIds)}</h2>
        {body && (
          <p className="answer-body">{withCitations(body, evidenceIds)}</p>
        )}
      </section>

      {a.gaps.length > 0 && (
        <section
          className="card pad"
          aria-label="Not concluded"
          style={{ gap: 8 }}
        >
          <h3 className="section-h">Not concluded</h3>
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              fontSize: 15,
              lineHeight: 1.5,
            }}
          >
            {a.gaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </section>
      )}

      {a.evidence.length > 0 && (
        <section
          className="card"
          aria-label="Sources"
          style={{ overflow: "hidden" }}
        >
          <div className="card-head" style={{ padding: "16px 20px" }}>
            <h3 className="section-h">Sources</h3>
            <span className="muted" style={{ fontSize: 13 }}>
              Open one to see the document&apos;s facts
            </span>
          </div>
          <div className="bt">
            {a.evidence.map((e) => (
              <Link
                key={e.id}
                id={`src-${e.id}`}
                className="src"
                href={`/facts?id=${e.document_id}`}
              >
                <span className="src-n">{e.id.slice(1)}</span>
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                  }}
                >
                  <span style={{ fontSize: 15 }}>
                    {docName(e.filename)}{" "}
                    <span className="mono muted">
                      {placeText({
                        page: e.page,
                        sheet: e.sheet,
                        cell_range: e.cell_range,
                      })}
                    </span>
                  </span>
                  <span
                    className="muted"
                    style={{ fontSize: 14, overflowWrap: "anywhere" }}
                  >
                    “
                    {e.quote.length > 220
                      ? `${e.quote.slice(0, 220)}…`
                      : e.quote}
                    ”
                  </span>
                </span>
                <Verdict ok={e.verified}>
                  {e.verified ? "Found" : "Not confirmed"}
                </Verdict>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid-2">
        {a.key_values.length > 0 && (
          <section
            className="card"
            aria-label="Key figures"
            style={{ overflow: "hidden" }}
          >
            <div style={{ padding: "16px 20px" }}>
              <h3 className="section-h">Key figures</h3>
            </div>
            <table className="tbl tbl-fixed">
              <colgroup>
                <col style={{ width: "44%" }} />
                <col style={{ width: "30%" }} />
                <col style={{ width: "26%" }} />
              </colgroup>
              <tbody>
                {a.key_values.map((kv, i) => (
                  <tr key={`${kv.label}-${i}`}>
                    <td>
                      {kv.label}
                      {kv.period && (
                        <div className="muted" style={{ fontSize: 13 }}>
                          {kv.period}
                        </div>
                      )}
                    </td>
                    <td className="r num" style={{ fontWeight: 600 }}>
                      {kv.value_text}
                    </td>
                    <td className="r">
                      <OriginBadge origin={kv.origin} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {a.calculations.length > 0 && (
          <section
            className="card"
            aria-label="How it was calculated"
            style={{ overflow: "hidden" }}
          >
            <div className="card-head" style={{ padding: "16px 20px" }}>
              <h3 className="section-h">How it was calculated</h3>
              <span className="muted" style={{ fontSize: 13 }}>
                Re-run in code
              </span>
            </div>
            {a.calculations.map((c) => (
              <div
                key={c.id}
                className="bt"
                style={{
                  padding: "12px 20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  fontSize: 14,
                }}
              >
                <span>{c.description}</span>
                <span
                  style={{
                    display: "flex",
                    gap: 12,
                    flexWrap: "wrap",
                    alignItems: "baseline",
                  }}
                >
                  <span
                    className="mono"
                    style={{ flex: 1, overflowWrap: "anywhere" }}
                  >
                    {c.expression} = {num(c.computed ?? c.result)}
                    {c.unit ? ` ${c.unit}` : ""}
                  </span>
                  <Verdict ok={c.matches}>
                    {c.matches ? "Matches" : "Differs, check this step"}
                  </Verdict>
                </span>
              </div>
            ))}
          </section>
        )}
      </div>

      {a.financial_year && (
        <details className="disc">
          <summary>
            <Icon name="chevron-right" size={14} />
            Financial year {a.financial_year.fy.replace(/^FY /, "")} totals used
          </summary>
          <div style={{ marginTop: 12 }}>
            <FyGroups summary={a.financial_year} compact />
          </div>
        </details>
      )}
    </article>
  );
}
