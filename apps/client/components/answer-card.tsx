import type { AnswerRecord, DocumentSummary } from "@kuki/types";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { CopyAnswer } from "@/components/copy-answer";
import { FyGroups } from "@/components/fy-groups";
import { Icon } from "@/components/icon";
import { Badge, OriginBadge } from "@/components/ui";
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
        {id.slice(1)}
      </a>
    );
  });
}

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
  const ok = a.status === "answered";

  return (
    <article className="card pad" aria-label="Answer" style={{ gap: 18 }}>
      <div className="card-head" style={{ alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div className="muted" style={{ fontSize: 13 }}>
            You asked
          </div>
          <h2 className="section-h" style={{ fontSize: 16 }}>
            {record.question}
          </h2>
        </div>
        <Badge kind={ok ? "default" : "warn"}>
          <Icon
            name={ok ? "check" : "alert"}
            size={12}
            color={ok ? "var(--ok)" : undefined}
          />
          {statusLabel(a.status)}
        </Badge>
      </div>

      <p
        style={{
          color: "var(--text-2)",
          fontSize: 15,
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
        }}
      >
        {withCitations(a.answer, evidenceIds)}
      </p>

      {a.key_values.length > 0 && (
        <section aria-label="Key figures" className="stack" style={{ gap: 8 }}>
          <h3 className="section-h">Key figures</h3>
          <div className="card" style={{ boxShadow: "none" }}>
            <table className="tbl tbl-fixed">
              <colgroup>
                <col style={{ width: "38%" }} />
                <col style={{ width: "24%" }} />
                <col style={{ width: "38%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Figure</th>
                  <th className="r">Value</th>
                  <th>Where it comes from</th>
                </tr>
              </thead>
              <tbody>
                {a.key_values.map((kv, i) => (
                  <tr key={`${kv.label}-${i}`}>
                    <td>
                      {kv.label}
                      {kv.period && (
                        <div className="muted" style={{ fontSize: 12 }}>
                          {kv.period}
                        </div>
                      )}
                    </td>
                    <td className="r num" style={{ fontWeight: 600 }}>
                      {kv.value_text}
                    </td>
                    <td>
                      <OriginBadge origin={kv.origin} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {a.calculations.length > 0 && (
        <details className="disc">
          <summary>
            <Icon name="chevron-right" size={14} />
            How it was worked out
          </summary>
          <ol
            style={{
              margin: "12px 0 0",
              paddingLeft: 20,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              fontSize: 13,
            }}
          >
            {a.calculations.map((c) => (
              <li key={c.id}>
                <div>{c.description}</div>
                <div
                  className="num"
                  style={{ fontWeight: 600, overflowWrap: "anywhere" }}
                >
                  {c.expression} = {num(c.computed ?? c.result)}
                  {c.unit ? ` ${c.unit}` : ""}
                </div>
                <span className="status muted" style={{ fontSize: 12 }}>
                  <Icon
                    name={c.matches ? "check" : "alert"}
                    size={12}
                    color={c.matches ? "var(--ok)" : "var(--warn)"}
                  />
                  {c.matches
                    ? "Checked by KuKi"
                    : "KuKi got a different result; check this step"}
                </span>
              </li>
            ))}
          </ol>
        </details>
      )}

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

      {a.evidence.length > 0 && (
        <section aria-label="Sources" className="stack" style={{ gap: 8 }}>
          <h3 className="section-h">Sources</h3>
          <div className="card" style={{ boxShadow: "none" }}>
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
                  <span style={{ fontSize: 13, fontWeight: 500 }}>
                    {placeText({
                      page: e.page,
                      sheet: e.sheet,
                      cell_range: e.cell_range,
                    })}{" "}
                    of {docName(e.filename)}
                  </span>
                  <span
                    className="muted"
                    style={{ fontSize: 12, overflowWrap: "anywhere" }}
                  >
                    “
                    {e.quote.length > 220
                      ? `${e.quote.slice(0, 220)}…`
                      : e.quote}
                    ”
                  </span>
                </span>
                <span
                  className="status"
                  style={{
                    fontSize: 12,
                    color: e.verified ? "var(--ok-ink)" : "var(--warn-ink)",
                  }}
                >
                  <Icon
                    name={e.verified ? "check-circle" : "alert"}
                    size={14}
                  />
                  {e.verified ? "Found" : "Not confirmed"}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {a.gaps.length > 0 && (
        <section aria-label="Good to know" role="note" className="note">
          <Icon name="info" style={{ flex: "none", marginTop: 2 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div className="strong">Good to know</div>
            <ul
              style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}
              className="muted"
            >
              {a.gaps.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <div className="card-head muted" style={{ fontSize: 13 }}>
        <span>
          Based on {used || record.documentIds.length} document
          {(used || record.documentIds.length) === 1 ? "" : "s"}
        </span>
        <CopyAnswer text={a.answer} />
      </div>
    </article>
  );
}
