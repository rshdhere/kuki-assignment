"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { Badge, FilterButton, Status } from "@/components/ui";
import type { DocumentRow } from "@/lib/data";

/** Processing queue table with row selection. */
export function DocumentsTable({ documents }: { documents: DocumentRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const selectAllRef = useRef<HTMLInputElement>(null);

  const allSelected =
    documents.length > 0 && selected.size === documents.length;
  const someSelected = selected.size > 0 && !allSelected;

  // `indeterminate` has no HTML attribute, so it has to be set on the element.
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected;
  }, [someSelected]);

  const toggleAll = () =>
    setSelected(
      allSelected ? new Set() : new Set(documents.map((d) => d.file)),
    );

  const toggle = (file: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(file)) next.delete(file);
      else next.add(file);
      return next;
    });

  return (
    <section className="card" aria-label="Processing queue">
      <div className="toolbar">
        <label htmlFor="filter" className="sr">
          Filter files
        </label>
        <input
          id="filter"
          type="text"
          className="field"
          placeholder="Filter files…"
        />
        <FilterButton>Status</FilterButton>
        <FilterButton>Type</FilterButton>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          style={{ marginLeft: "auto" }}
        >
          Columns
        </button>
      </div>
      <div className="scroll bt">
        <table className="tbl" style={{ minWidth: 960 }}>
          <thead>
            <tr>
              <th style={{ width: 32 }}>
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  className="check"
                  aria-label="Select all"
                  checked={allSelected}
                  onChange={toggleAll}
                />
              </th>
              <th>File</th>
              <th>Type</th>
              <th>Organisation</th>
              <th>Period</th>
              <th>Status</th>
              <th>Attempts</th>
              <th style={{ width: 44 }}>
                <span className="sr">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {documents.map((d) => {
              const isSelected = selected.has(d.file);
              const classes = [
                d.state === "duplicate" && "dim",
                isSelected && "selected",
              ].filter(Boolean);
              return (
                <tr
                  key={d.file}
                  className={classes.length ? classes.join(" ") : undefined}
                >
                  <td>
                    <input
                      type="checkbox"
                      className="check"
                      aria-label={`Select ${d.file}`}
                      checked={isSelected}
                      onChange={() => toggle(d.file)}
                    />
                  </td>
                  <td>
                    <div className="strong">{d.file}</div>
                    <div className="meta">{d.meta}</div>
                  </td>
                  {d.type ? (
                    <>
                      <td>
                        <Badge>{d.type}</Badge>
                      </td>
                      <td
                        className={
                          d.organisation === "Not stated" ? "muted" : undefined
                        }
                      >
                        {d.organisation}
                      </td>
                      <td className="num">{d.period}</td>
                    </>
                  ) : (
                    <td colSpan={3}>{d.organisation}</td>
                  )}
                  <td>
                    <DocumentStatus state={d.state} note={d.note} />
                  </td>
                  <td className="meta">{d.attempts}</td>
                  <td>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Actions for ${d.file}`}
                    >
                      <Icon name="dots" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="foot">
        <span aria-live="polite">
          Example states · {selected.size} of {documents.length} rows selected
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn btn-outline btn-sm" disabled>
            Previous
          </button>
          <button type="button" className="btn btn-outline btn-sm">
            Next
          </button>
        </div>
      </div>
    </section>
  );
}

function DocumentStatus({
  state,
  note,
}: {
  state: DocumentRow["state"];
  note?: string;
}) {
  if (state === "extracting") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          minWidth: 170,
        }}
      >
        <span className="status">
          <Status state="extracting" label="Extracting" />
          <span className="muted">{note}</span>
        </span>
        <div className="bar indet" role="progressbar" aria-label="Extracting">
          <i />
        </div>
      </div>
    );
  }
  if (state === "retrying") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Status state="retrying" label="Retrying in 8 s" />
        <span className="muted" style={{ fontSize: 12 }}>
          {note}
        </span>
      </div>
    );
  }
  return <Status state={state} />;
}
