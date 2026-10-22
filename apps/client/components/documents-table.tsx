"use client";

import type { DocumentSummary } from "@kuki/types";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/icon";
import { Badge, Status } from "@/components/ui";
import { docName, docTypeLabel, period, problemText } from "@/lib/format";

/** The uploaded documents. Ready documents open their facts. */
export function DocumentsTable({
  documents,
  loading,
}: {
  documents: DocumentSummary[];
  loading: boolean;
}) {
  const [filter, setFilter] = useState("");
  const visible = documents.filter((d) =>
    d.filename.toLowerCase().includes(filter.trim().toLowerCase()),
  );

  return (
    <section className="card" aria-label="Your documents">
      <div className="card-head" style={{ padding: "16px 16px 12px" }}>
        <div>
          <h2 className="section-h">Your documents</h2>
          <p className="section-d">
            Open a ready document to see what KuKi found in it.
          </p>
        </div>
        <label htmlFor="filter" className="sr">
          Find a document
        </label>
        <input
          id="filter"
          type="search"
          className="field"
          placeholder="Find a document…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <div className="scroll bt">
        <table className="tbl tbl-fixed" style={{ minWidth: 860 }}>
          <colgroup>
            <col style={{ width: "30%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "22%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: 48 }} />
          </colgroup>
          <thead>
            <tr>
              <th>Document</th>
              <th>Type</th>
              <th>Organisation</th>
              <th>Period</th>
              <th>Status</th>
              <th>
                <span className="sr">Open</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  {loading ? "Loading…" : "No documents match."}
                </td>
              </tr>
            )}
            {visible.map((d) => {
              const problem = problemText(d.status, d.lastError);
              const ready = d.status === "succeeded";
              return (
                <tr key={d.id}>
                  <td>
                    {ready ? (
                      <Link
                        href={`/facts?id=${d.id}`}
                        className="rowbtn strong"
                      >
                        {docName(d.filename)}
                      </Link>
                    ) : (
                      <span className="strong">{docName(d.filename)}</span>
                    )}
                    <div className="muted" style={{ fontSize: 12 }}>
                      {d.filename}
                      {ready && `, ${d.factCount} facts found`}
                    </div>
                  </td>
                  <td>
                    {d.docType ? (
                      <Badge>{docTypeLabel(d.docType)}</Badge>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className={d.organisation ? undefined : "muted"}>
                    {d.organisation ?? (ready ? "Not named" : "—")}
                  </td>
                  <td className="num">
                    {d.periodStart || d.periodEnd ? (
                      period(d.periodStart, d.periodEnd)
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <Status state={d.status} />
                    {problem && (
                      <div
                        className="muted"
                        style={{ fontSize: 12, marginTop: 2 }}
                      >
                        {problem}
                      </div>
                    )}
                    {d.status === "extracting" && (
                      <div
                        className="bar indet"
                        role="progressbar"
                        aria-label="Reading"
                        style={{ marginTop: 6 }}
                      >
                        <i />
                      </div>
                    )}
                  </td>
                  <td>
                    {ready && (
                      <Link
                        className="icon-btn"
                        href={`/facts?id=${d.id}`}
                        aria-label={`Open ${d.filename}`}
                      >
                        <Icon name="chevron-right" />
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
