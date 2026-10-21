import { FactsExplorer } from "@/components/facts-explorer";
import { Icon } from "@/components/icon";
import { Topbar } from "@/components/topbar";
import { Badge } from "@/components/ui";
import { adaniDetails, adaniFacts } from "@/lib/data";

export default function FactsPage() {
  return (
    <>
      <Topbar
        crumbs={[
          { label: "Extracted facts", href: "/facts" },
          { label: "Adani commercial electricity bill" },
        ]}
        actions={
          <>
            <button type="button" className="btn btn-outline">
              Re-extract
            </button>
            <button type="button" className="btn btn-primary">
              Open PDF
              <Icon name="external" size={14} className="nudge" />
            </button>
          </>
        }
      />
      <main className="page">
        <div className="head-text" style={{ gap: 8 }}>
          <h1 className="title">Adani commercial electricity bill</h1>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              alignItems: "center",
            }}
          >
            <Badge kind="soft">Electricity bill</Badge>
            <Badge>2 pages</Badge>
            <Badge>
              <Icon name="check" size={12} color="var(--ok)" />
              Succeeded
            </Badge>
            <span className="muted" style={{ fontSize: 13 }}>
              Extracted 22 Oct 2026, 00:12
            </span>
          </div>
        </div>

        <div className="tabs" role="tablist" aria-label="Views">
          <button type="button" className="tab" role="tab" aria-selected>
            Facts <span>9</span>
          </button>
          <button
            type="button"
            className="tab"
            role="tab"
            aria-selected={false}
          >
            Checks <span>1</span>
          </button>
          <button
            type="button"
            className="tab"
            role="tab"
            aria-selected={false}
          >
            Page text
          </button>
          <button
            type="button"
            className="tab"
            role="tab"
            aria-selected={false}
          >
            JSON
          </button>
        </div>

        <FactsExplorer
          facts={adaniFacts}
          details={
            <section className="card pad" aria-label="Details">
              <h2 className="card-h">Details</h2>
              <dl className="dl">
                {adaniDetails.map(([k, v]) => (
                  <div key={k} style={{ display: "contents" }}>
                    <dt className="muted">{k}</dt>
                    <dd className={k === "Account" ? "mono" : undefined}>
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          }
        />
      </main>
    </>
  );
}
