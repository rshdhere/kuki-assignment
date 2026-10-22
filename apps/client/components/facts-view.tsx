"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FactsExplorer } from "@/components/facts-explorer";
import { Topbar } from "@/components/topbar";
import { Badge, PageHeading } from "@/components/ui";
import { api } from "@/lib/api";
import { docName, docTypeLabel, fyOf, period } from "@/lib/format";
import { usePoll } from "@/lib/use-poll";

const fyLabel = (start: string | null, end: string | null) => {
  const a = fyOf(start);
  const b = fyOf(end);
  if (!a && !b) return "—";
  return a && b && a !== b ? `${a} to ${b}` : `FY ${a ?? b}`;
};

/** The facts found in one document, picked from the selector. */
export function FactsView() {
  const router = useRouter();
  const params = useSearchParams();
  const docs = usePoll(api.documents);
  const ready = (docs.data ?? []).filter((d) => d.status === "succeeded");
  const id = params.get("id") ?? ready[0]?.id ?? null;
  const detail = usePoll(
    () => (id ? api.document(id) : Promise.resolve(null)),
    0,
    id,
  );
  const doc = detail.data?.document;

  return (
    <>
      <Topbar
        crumbs={[
          { label: "Facts found", href: "/facts" },
          ...(doc ? [{ label: docName(doc.filename) }] : []),
        ]}
        actions={
          ready.length > 0 && (
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
              }}
            >
              <span className="muted">Document</span>
              <select
                className="field"
                style={{ width: 280 }}
                value={id ?? ""}
                onChange={(e) => router.push(`/facts?id=${e.target.value}`)}
              >
                {ready.map((d) => (
                  <option key={d.id} value={d.id}>
                    {docName(d.filename)}
                  </option>
                ))}
              </select>
            </label>
          )
        }
      />
      <main className="page">
        {!docs.loading && ready.length === 0 && (
          <PageHeading
            title="Facts found"
            lede="Nothing has been read yet. Upload documents on the Documents page and their facts will appear here."
          />
        )}
        {detail.error && (
          <p className="muted">
            This document couldn&apos;t be loaded. Try again in a moment.
          </p>
        )}
        {doc && (
          <>
            <PageHeading
              title={doc.title ?? docName(doc.filename)}
              lede={doc.summary ?? undefined}
              aside={
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {doc.docType && (
                    <Badge kind="soft">{docTypeLabel(doc.docType)}</Badge>
                  )}
                  {doc.pageCount && <Badge>{doc.pageCount} pages</Badge>}
                  <Badge>{detail.data?.facts.length ?? 0} facts</Badge>
                </div>
              }
            />

            <section className="grid-stats" aria-label="About this document">
              <InfoCard
                label="Organisation"
                value={doc.organisation ?? "Not named"}
              />
              <InfoCard label="Issued by" value={doc.issuer ?? "Not stated"} />
              <InfoCard
                label="Period covered"
                value={
                  doc.periodStart || doc.periodEnd
                    ? period(doc.periodStart, doc.periodEnd)
                    : "Not stated"
                }
              />
              <InfoCard
                label="Financial year"
                value={fyLabel(doc.periodStart, doc.periodEnd)}
              />
            </section>

            <FactsExplorer
              key={doc.id}
              facts={detail.data?.facts ?? []}
              segments={detail.data?.segments ?? []}
              issues={doc.issues}
            />
          </>
        )}
      </main>
    </>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card pad" style={{ gap: 4 }}>
      <span className="stat-label">{label}</span>
      <span style={{ fontWeight: 600, fontSize: 15, overflowWrap: "anywhere" }}>
        {value}
      </span>
    </div>
  );
}
