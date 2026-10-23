"use client";

import type { DocumentEvent } from "@kuki/types";
import { ActivityFeed } from "@/components/activity-feed";
import { DocumentsTable } from "@/components/documents-table";
import { Icon } from "@/components/icon";
import { Topbar } from "@/components/topbar";
import { CardHead, PageHeading, StatCard } from "@/components/ui";
import { UploadButton } from "@/components/upload-button";
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

const pct = (n: number, of: number) => (of ? (100 * n) / of : 0);

export function DocumentsView() {
  const docs = usePoll(api.documents, POLL_MS);
  const events = usePoll<DocumentEvent[]>(() => api.events(8), POLL_MS);
  const all = docs.data ?? [];
  const list = all.filter((d) => d.status !== "duplicate");

  const ready = list.filter((d) => d.status === "succeeded").length;
  const working = list.filter((d) => isActive(d.status)).length;
  const failed = list.filter((d) => d.status === "failed").length;
  const copies = all.length - list.length;
  const empty = !docs.loading && all.length === 0;

  return (
    <>
      <Topbar
        crumbs={[{ label: "Documents" }]}
        actions={
          <>
            <a href="/docs" className="btn">
              <Icon name="doc" />
              API docs
            </a>
            <UploadButton />
          </>
        }
      />
      <main className="page">
        <PageHeading
          title="Documents"
          lede={
            list.length
              ? `${list.length} file${list.length === 1 ? "" : "s"} uploaded. Processing runs in the background and survives a restart.`
              : "Upload sustainability documents. KuKi reads each one and pulls out the key facts, each linked to the page it came from."
          }
        />

        {docs.error && (
          <div role="alert" className="alert">
            <Icon
              name="alert"
              color="var(--warn-ink)"
              style={{ flex: "none", marginTop: 3 }}
            />
            <div className="alert-body">
              KuKi can&apos;t reach its server right now. The list will refresh
              when it&apos;s back.
            </div>
          </div>
        )}

        {!empty && (
          <section
            aria-label="Summary"
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            <div className="grid-stats">
              <StatCard
                label="Ready"
                tag="Facts"
                value={String(ready)}
                unit={`of ${list.length}`}
              />
              <StatCard
                label="In progress"
                tag="Queue"
                tone={working ? "hl" : undefined}
                value={String(working)}
                foot={working ? "Updates on its own" : "Nothing waiting"}
              />
              <StatCard
                label="Duplicates skipped"
                tag="Log"
                value={String(copies)}
                foot="Same content uploaded twice"
              />
              <StatCard
                label="Failed"
                tag="Retry"
                tone={failed ? "bad" : undefined}
                value={String(failed)}
                foot={failed ? "Upload again to retry" : "No problems"}
              />
            </div>
            <div
              className="split-bar"
              role="img"
              aria-label={`${ready} ready, ${working} in progress, ${failed} failed, ${copies} duplicate`}
            >
              {[
                [ready, "var(--ok)"],
                [working, "var(--calc)"],
                [failed, "var(--bad)"],
                [copies, "#8e8f91"],
              ].map(([n, color]) =>
                n ? (
                  <i
                    key={color}
                    style={{
                      width: `${pct(Number(n), all.length)}%`,
                      background: String(color),
                    }}
                  />
                ) : null,
              )}
            </div>
          </section>
        )}

        <div className="split split-docs">
          {empty ? (
            <section className="card pad" aria-label="How it works">
              <CardHead title="How it works" />
              <ol className="steps">
                {STEPS.map(([title, body], i) => (
                  <li
                    key={title}
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    <span className="step-n">{i + 1}</span>
                    <b style={{ fontWeight: 600 }}>{title}</b>
                    <span className="muted" style={{ fontSize: 14 }}>
                      {body}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          ) : (
            <DocumentsTable documents={all} loading={docs.loading} />
          )}

          <div className="stack">
            <UploadDropzone />
            <ActivityFeed events={events.data ?? []} />
          </div>
        </div>
      </main>
    </>
  );
}
