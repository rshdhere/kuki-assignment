import { EvaluationShell } from "@/components/evaluation-shell";
import { Icon } from "@/components/icon";
import {
  Badge,
  CardHead,
  FilterButton,
  MarkLabel,
  StatCard,
} from "@/components/ui";
import { checkScores, evalCases } from "@/lib/data";

const DIFF: { kind: "del" | "ins"; line: string }[] = [
  { kind: "del", line: "- amount: z.number()" },
  { kind: "ins", line: "+ amounts: z.array(z.object({" },
  { kind: "ins", line: '+   role: z.enum(["current_bill", "payable_by_due",' },
  { kind: "ins", line: '+     "payable_by_discount", "payable_after_due"]),' },
  { kind: "ins", line: "+   value: z.number(), cite: CitationSchema," },
  { kind: "ins", line: "+ }))" },
];

export default function EvaluationPage() {
  return (
    <EvaluationShell>
      <div role="note" className="note">
        <Icon name="info" style={{ flex: "none", marginTop: 2 }} />
        <div>
          <div className="strong">Scores below are placeholders</div>
          <div className="muted" style={{ fontSize: 13 }}>
            Expected answers are real. Pass and fail marks fill in from
            evals/results/baseline.json and improved.json.
          </div>
        </div>
      </div>

      <section className="grid-stats" aria-label="Run comparison">
        <StatCard
          label="Baseline"
          value="8.5"
          unit="/ 12"
          foot="8 pass · 1 partial · 3 fail"
          top={<span className="meta">r_01</span>}
        />
        <StatCard
          label="Improved"
          value="10.5"
          unit="/ 12"
          foot="10 pass · 1 partial · 1 fail"
          top={
            <Badge>
              <Icon name="arrow-up-right" size={12} color="var(--ok)" />
              +2.0
            </Badge>
          }
        />
        <div className="card pad lift" style={{ gap: 10 }}>
          <span className="stat-label">Changes</span>
          <dl className="kv" style={{ fontSize: 13 }}>
            <dt>Fixed</dt>
            <dd className="mono">E02 E03 E12</dd>
            <dt>Regressed</dt>
            <dd className="mono" style={{ color: "var(--bad-ink)" }}>
              E08
            </dd>
            <dt>Still partial</dt>
            <dd className="mono">E09</dd>
          </dl>
        </div>
      </section>

      <div className="row" style={{ alignItems: "stretch" }}>
        <section
          className="card pad"
          aria-label="Score by check"
          style={{ flex: "1 1 380px", gap: 16 }}
        >
          <div className="card-head" style={{ alignItems: "flex-start" }}>
            <CardHead
              title="Score by check"
              desc="Share of cases passing each check"
            />
            <div
              style={{
                display: "flex",
                gap: 12,
                fontSize: 12,
                color: "var(--text-2)",
              }}
            >
              <span
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <span
                  className="legend-swatch"
                  style={{ background: "var(--sage)" }}
                />
                r_01
              </span>
              <span
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <span
                  className="legend-swatch"
                  style={{ background: "var(--emerald)" }}
                />
                r_02
              </span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {checkScores.map((s, i) => (
              <div key={s.check} className="score">
                <span style={{ gridRow: "span 2" }}>{s.check}</span>
                <div className="hbar">
                  <i
                    style={{
                      width: `${s.baseline}%`,
                      background: "var(--sage)",
                      animationDelay: `${150 + i * 50}ms`,
                    }}
                  />
                </div>
                <span className="mono muted" style={{ textAlign: "right" }}>
                  {s.baseline}%
                </span>
                <div className="hbar">
                  <i
                    style={{
                      width: `${s.improved}%`,
                      background: "var(--emerald)",
                      animationDelay: `${250 + i * 50}ms`,
                    }}
                  />
                </div>
                <span className="mono" style={{ textAlign: "right" }}>
                  {s.improved}%
                </span>
              </div>
            ))}
          </div>
        </section>
        <section
          className="card pad"
          aria-label="What changed"
          style={{ flex: "1 1 380px" }}
        >
          <CardHead
            title="What changed in r_02"
            desc="Each amount and quantity now carries a role and a unit, so answers stop taking the first number on the page."
          />
          <pre className="diff">
            {DIFF.map((d) => (
              <span key={d.line} className={d.kind}>
                {d.line}
              </span>
            ))}
          </pre>
        </section>
      </div>

      <section className="card" aria-label="Cases">
        <div className="toolbar">
          <label htmlFor="cfilter" className="sr">
            Filter cases
          </label>
          <input
            id="cfilter"
            type="text"
            className="field"
            placeholder="Filter cases…"
            style={{ width: 220 }}
          />
          <FilterButton>Result</FilterButton>
          <FilterButton>Document</FilterButton>
        </div>
        <div className="scroll bt">
          <table className="tbl" style={{ minWidth: 1000 }}>
            <thead>
              <tr>
                <th>Case</th>
                <th>Question</th>
                <th>Expected (verified)</th>
                <th>Source</th>
                <th>r_01</th>
                <th>r_02</th>
              </tr>
            </thead>
            <tbody>
              {evalCases.map((c) => (
                <tr key={c.id}>
                  <td className="meta">{c.id}</td>
                  <td className="strong">{c.question}</td>
                  <td>{c.expected}</td>
                  <td className="meta" style={{ color: "var(--text-2)" }}>
                    {c.source}
                  </td>
                  <td>
                    <MarkLabel mark={c.baseline} />
                  </td>
                  <td>
                    <MarkLabel mark={c.improved} change={c.change} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </EvaluationShell>
  );
}
