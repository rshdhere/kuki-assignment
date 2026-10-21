import { Icon } from "@/components/icon";
import { Topbar } from "@/components/topbar";
import { DocumentsTable } from "@/components/documents-table";
import { Badge, CardHead, PageHeading, StatCard } from "@/components/ui";
import { UploadButton } from "@/components/upload-button";
import { activity, documents, queue } from "@/lib/data";

export default function DocumentsPage() {
  return (
    <>
      <Topbar crumbs={[{ label: "Documents" }]} actions={<UploadButton />} />
      <main className="page">
        <PageHeading
          title="Documents"
          lede="7 files in this batch. Processing runs in the background and survives a restart."
          aside={<span className="live">Live · refreshes every 2 s</span>}
        />

        <section className="grid-stats" aria-label="Batch summary">
          <StatCard
            label="Processed"
            value="4"
            unit="/ 6"
            foot="Unique files in this batch"
            top={<Badge>67%</Badge>}
          >
            <div className="meter">
              <i style={{ width: "67%" }} />
            </div>
          </StatCard>
          <StatCard
            label="In progress"
            value="2"
            foot="1 extracting · 1 waiting to retry"
          />
          <StatCard
            label="Duplicates skipped"
            value="1"
            foot="Matched by content hash"
          />
          <StatCard
            label="Failed"
            value="0"
            foot="Every job still has retries left"
          />
        </section>

        <label className="drop" htmlFor="upload">
          <span className="drop-icon">
            <Icon name="upload" size={18} color="var(--emerald)" />
          </span>
          <span
            style={{
              flex: "1 1 260px",
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span style={{ fontWeight: 500 }}>Drag files here to upload</span>
            <span className="muted" style={{ fontSize: 13 }}>
              PDF, XLSX or CSV, up to 25 MB each. Several at once is fine.
            </span>
          </span>
          <span className="btn btn-outline">Browse files</span>
          <input id="upload" type="file" multiple className="sr" />
        </label>

        <DocumentsTable documents={documents} />

        <div className="grid-2">
          <section className="card pad" aria-label="Activity">
            <CardHead title="Activity" desc="Latest job events" />
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {activity.map((e) => (
                <div key={e.time} style={{ display: "flex", gap: 12 }}>
                  <span
                    className="meta"
                    style={{ width: 64, flex: "none", paddingTop: 1 }}
                  >
                    {e.time}
                  </span>
                  <span>
                    <b className="strong">{e.subject}</b> {e.text}
                  </span>
                </div>
              ))}
            </div>
          </section>
          <section className="card pad" aria-label="Queue">
            <CardHead title="Queue" desc="pg-boss settings and current state" />
            <dl className="kv">
              {queue.map(([k, v]) => (
                <div key={k} style={{ display: "contents" }}>
                  <dt className="muted">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </main>
    </>
  );
}
