"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FactsExplorer } from "@/components/facts-explorer";
import { Select } from "@/components/select";
import { Topbar } from "@/components/topbar";
import { PageHeading } from "@/components/ui";
import { api } from "@/lib/api";
import { docName, docTypeLabel, fyOf, period } from "@/lib/format";
import { usePoll } from "@/lib/use-poll";

const fyLabel = (start: string | null, end: string | null) => {
  const a = fyOf(start);
  const b = fyOf(end);
  if (!a && !b) return null;
  return a && b && a !== b ? `FY ${a} to ${b}` : `FY ${a ?? b}`;
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
  const facts = detail.data?.facts ?? [];

  return (
    <>
      <Topbar
        crumbs={[
          { label: "Documents", href: "/documents" },
          { label: doc ? docName(doc.filename) : "Extracted facts" },
        ]}
        actions={
          ready.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 14,
                minWidth: 0,
                maxWidth: "100%",
              }}
            >
              <span className="muted" aria-hidden="true">
                Document
              </span>
              <Select
                label="Document"
                value={id}
                onChange={(next) => router.push(`/facts?id=${next}`)}
                options={ready.map((d) => ({
                  value: d.id,
                  label: docName(d.filename),
                  hint: [
                    docTypeLabel(d.docType),
                    period(d.periodStart, d.periodEnd),
                  ]
                    .filter((x) => x && x !== "—")
                    .join(" · "),
                }))}
              />
            </div>
          )
        }
      />
      <main className="page">
        {!docs.loading && ready.length === 0 && (
          <PageHeading
            title="Extracted facts"
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
              lede={[
                docTypeLabel(doc.docType),
                doc.organisation,
                doc.periodStart || doc.periodEnd
                  ? period(doc.periodStart, doc.periodEnd)
                  : null,
                fyLabel(doc.periodStart, doc.periodEnd),
                `${facts.length} fact${facts.length === 1 ? "" : "s"}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            />
            <FactsExplorer
              key={doc.id}
              facts={facts}
              summary={doc.summary}
              segments={detail.data?.segments ?? []}
              issues={doc.issues}
              about={[
                ["Organisation", doc.organisation ?? "Not named"],
                ["Issued by", doc.issuer ?? "Not stated"],
                [
                  "Period",
                  doc.periodStart || doc.periodEnd
                    ? period(doc.periodStart, doc.periodEnd)
                    : "Not stated",
                ],
                [
                  "Financial year",
                  fyLabel(doc.periodStart, doc.periodEnd) ?? "–",
                ],
                ["Pages", doc.pageCount ? String(doc.pageCount) : "–"],
                ["File", doc.filename],
              ]}
            />
          </>
        )}
      </main>
    </>
  );
}
