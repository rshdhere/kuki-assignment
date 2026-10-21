import { Icon } from "@/components/icon";
import { Topbar } from "@/components/topbar";
import {
  Badge,
  CardHead,
  FilterButton,
  PageHeading,
  StatCard,
  Status,
} from "@/components/ui";
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
                      type="checkbox"
                      className="check"
                      aria-label="Select all"
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
                {documents.map((d) => (
                  <tr
                    key={d.file}
                    className={d.state === "duplicate" ? "dim" : undefined}
                  >
                    <td>
                      <input
                        type="checkbox"
                        className="check"
                        aria-label={`Select ${d.file}`}
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
                ))}
              </tbody>
            </table>
          </div>
          <div className="foot">
            <span>Example states · 0 of 7 rows selected</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled
              >
                Previous
              </button>
              <button type="button" className="btn btn-outline btn-sm">
                Next
              </button>
            </div>
          </div>
        </section>

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
            <CardHead
              title="Queue"
              desc="pg-boss settings and current state"
            />
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

function DocumentStatus({
  state,
  note,
}: {
  state: (typeof documents)[number]["state"];
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
