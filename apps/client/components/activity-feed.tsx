import type { DocumentEvent } from "@kuki/types";
import { time } from "@/lib/format";

const DOT: Record<DocumentEvent["type"], string> = {
  upload_started: "#8e8f91",
  queued: "#8e8f91",
  duplicate: "#8e8f91",
  extraction_started: "var(--calc)",
  extraction_failed: "var(--bad)",
  extraction_succeeded: "var(--ok)",
};

/** The latest processing events, newest first. */
export function ActivityFeed({ events }: { events: DocumentEvent[] }) {
  return (
    <section className="card pad" aria-label="Activity" style={{ gap: 6 }}>
      <div className="card-head" style={{ marginBottom: 4 }}>
        <h2 className="section-h">Activity</h2>
        <span className="muted" style={{ fontSize: 13 }}>
          Newest first
        </span>
      </div>
      {events.length === 0 && (
        <span className="muted" style={{ fontSize: 14 }}>
          Uploads and processing steps will show here.
        </span>
      )}
      {events.map((e) => (
        <div key={e.id} className="tl">
          <span className="mono muted">{time(e.createdAt)}</span>
          <i style={{ background: DOT[e.type] }} aria-hidden="true" />
          <span title={e.message}>{e.message}</span>
        </div>
      ))}
    </section>
  );
}
