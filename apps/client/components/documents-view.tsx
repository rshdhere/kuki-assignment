"use client";

import { DocumentsTable } from "@/components/documents-table";
import { CardHead, PageHeading, StatCard } from "@/components/ui";
import { UploadDropzone } from "@/components/upload-dropzone";
import { api } from "@/lib/api";
import { isActive } from "@/lib/format";
import { usePoll } from "@/lib/use-poll";

const POLL_MS = 2000;

const STEPS = [
  [
    "Upload",
    "Add electricity or water bills, consumption spreadsheets, waste records or policies.",
  ],
  [
    "KuKi reads them",
    "Each document is read in the background. You can leave this page while it works.",
  ],
  [
    "Check and ask",
    "See the facts found in each document, ask questions, and get yearly totals.",
  ],
] as const;

export function DocumentsView() {
  const docs = usePoll(api.documents, POLL_MS);
  const all = docs.data ?? [];
  const list = all.filter((d) => d.status !== "duplicate");

  const ready = list.filter((d) => d.status === "succeeded").length;
  const reading = list.filter((d) => isActive(d.status)).length;
  const failed = list.filter((d) => d.status === "failed").length;
  const copies = all.length - list.length;
  const pct = list.length ? Math.round((100 * ready) / list.length) : 0;

  return (
    <main className="page">
      <PageHeading
        title="Documents"
        lede="Upload sustainability documents. KuKi reads each one and pulls out the key facts, each linked to the page it came from."
      />

      <section className="grid-stats" aria-label="Summary">
        <StatCard
          label="Ready"
          value={String(ready)}
          unit={`of ${list.length}`}
          foot="Read and ready to explore"
        >
          <div className="meter">
            <i style={{ width: `${pct}%` }} />
          </div>
        </StatCard>
        <StatCard
          label="Being read"
          value={String(reading)}
          foot={reading ? "Updates on its own" : "Nothing waiting"}
        />
        <StatCard
          label="Couldn't be read"
          value={String(failed)}
          foot={failed ? "See the reason in the list" : "No problems"}
        />
        <StatCard
          label="Copies skipped"
          value={String(copies)}
          foot="Same file uploaded twice"
        />
      </section>

      <UploadDropzone />

      {docs.error && (
        <div role="alert" className="alert">
          <div className="alert-body">
            KuKi can&apos;t reach its server right now. The list will refresh
            when it&apos;s back.
          </div>
        </div>
      )}

      {!docs.loading && list.length === 0 ? (
        <section
          className="card pad"
          aria-label="How it works"
          style={{ gap: 16 }}
        >
          <CardHead title="How it works" />
          <ol className="steps" style={{ listStyle: "none", padding: 0 }}>
            {STEPS.map(([title, body], i) => (
              <li
                key={title}
                style={{ display: "flex", flexDirection: "column", gap: 8 }}
              >
                <span className="step-n">{i + 1}</span>
                <b style={{ fontWeight: 600 }}>{title}</b>
                <span className="muted" style={{ fontSize: 13 }}>
                  {body}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <DocumentsTable documents={list} loading={docs.loading} />
      )}
    </main>
  );
}
