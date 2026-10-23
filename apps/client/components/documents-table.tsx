"use client";

import type { DocumentSummary } from "@kuki/types";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/icon";
import { Status } from "@/components/ui";
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
    <section
      className="card"
      aria-label="Your documents"
      style={{ overflow: "hidden" }}
    >
      <div className="card-head" style={{ padding: "16px 20px" }}>
        <div>
          <h2 className="section-h">Your documents</h2>
          <p className="section-d">Open a ready document to see its facts.</p>
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
      <div className="scroll">
        <table className="tbl tbl-fixed" style={{ minWidth: 820 }}>
          <colgroup>
            <col style={{ width: "36%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "24%" }} />
            <col style={{ width: 72 }} />
            <col style={{ width: 52 }} />
          </colgroup>
          <thead>
            <tr>
              <th>File</th>
              <th>Type</th>
              <th>Period</th>
              <th>Status</th>
              <th>Tries</th>
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
              const copy = d.status === "duplicate";
              return (
                <tr key={d.id} className={copy ? "dim" : undefined}>
                  <td>
                    {ready ? (
                      <Link
                        href={`/facts?id=${d.id}`}
                        className="rowbtn strong"
                      >
                        {docName(d.filename)}
                      </Link>
                    ) : (
                      <span className={copy ? undefined : "strong"}>
                        {docName(d.filename)}
                      </span>
                    )}
                    <div className="muted" style={{ fontSize: 13 }}>
                      {d.organisation ?? d.filename}
                      {ready &&
                        ` · ${d.factCount} fact${d.factCount === 1 ? "" : "s"}`}
                      {ready &&
                        d.issues.length > 0 &&
                        ` · ${d.issues.length} issue${d.issues.length === 1 ? "" : "s"}`}
                    </div>
                  </td>
                  <td className={d.docType ? undefined : "muted"}>
                    {docTypeLabel(d.docType) ?? "–"}
                  </td>
                  <td className="num">
                    {d.periodStart || d.periodEnd ? (
                      period(d.periodStart, d.periodEnd)
                    ) : (
                      <span className="muted">–</span>
                    )}
                  </td>
                  <td>
                    <Status state={d.status} />
                    {problem && (
                      <div
                        className="muted"
                        style={{ fontSize: 13, marginTop: 4 }}
                      >
                        {problem}
                      </div>
                    )}
                  </td>
                  <td className="mono muted">{copy ? "–" : d.attempts}</td>
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
