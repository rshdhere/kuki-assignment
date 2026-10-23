"use client";

import type { AnswerRecord } from "@kuki/types";
import { useState, type FormEvent } from "react";
import { AnswerCard } from "@/components/answer-card";
import { Icon } from "@/components/icon";
import { Topbar } from "@/components/topbar";
import { PageHeading } from "@/components/ui";
import { api } from "@/lib/api";
import { docName, isActive, statusLabel } from "@/lib/format";
import { usePoll } from "@/lib/use-poll";

const SUGGESTIONS = [
  "What electricity consumption does each bill report, and for which period?",
  "Does the water consumption match the meter readings?",
  "What total waste quantity is recorded?",
  "Do the spreadsheet's monthly values and annual totals agree?",
  "Does the quality policy set a deadline for resolving customer complaints?",
  "What was the total electricity consumption in FY 2024-25?",
];

const STATUS_DOT: Record<string, string> = {
  answered: "var(--ok)",
  partial: "var(--warn)",
  conflicting_evidence: "var(--warn)",
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export function AskView() {
  const docs = usePoll(api.documents);
  const earlier = usePoll(api.answers);
  const all = docs.data ?? [];
  const ready = all.filter((d) => d.status === "succeeded");
  const pending = all.filter((d) => isActive(d.status)).length;

  // null means every ready document.
  const [scope, setScope] = useState<Set<string> | null>(null);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState<AnswerRecord | null>(null);
  const [allEarlier, setAllEarlier] = useState(false);
  const earlierList = earlier.data ?? [];
  const earlierShown = allEarlier ? earlierList : earlierList.slice(0, 6);

  const selected = scope ?? new Set(ready.map((d) => d.id));
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setScope(next);
  };

  const submit = async (e?: FormEvent, text = question) => {
    e?.preventDefault();
    if (!text.trim() || busy || selected.size === 0) return;
    setBusy(true);
    setError(null);
    setQuestion(text);
    setShown(null);
    try {
      setShown(await api.ask(text.trim(), scope === null ? [] : [...scope]));
      void earlier.refresh();
    } catch {
      setError("KuKi couldn't answer just now. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  const startOver = () => {
    setShown(null);
    setQuestion("");
    setError(null);
  };

  return (
    <>
      <Topbar
        crumbs={[{ label: "Ask" }]}
        actions={
          shown && (
            <button type="button" className="btn" onClick={startOver}>
              <Icon name="plus" />
              New question
            </button>
          )
        }
      />
      <main className="page">
        {!shown && !busy && (
          <PageHeading
            title="Ask"
            lede="Ask about usage, amounts, policies or a financial year. Every answer shows where in your documents it comes from."
          />
        )}

        <form
          onSubmit={(e) => void submit(e)}
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
          <div className="composer">
            <Icon
              name="search"
              size={20}
              style={{ flex: "none", alignSelf: "center" }}
            />
            <label htmlFor="ask" className="sr">
              Your question
            </label>
            <textarea
              id="ask"
              rows={1}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void submit();
                }
              }}
              placeholder="How much water was used in December 2025?"
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={busy || !question.trim() || selected.size === 0}
            >
              {busy ? "Reading…" : "Get answer"}
            </button>
          </div>
          <span className="muted" style={{ fontSize: 14 }}>
            Looking in {selected.size} of {ready.length} processed document
            {ready.length === 1 ? "" : "s"}
            {pending > 0 && ` · ${pending} still processing`}
          </span>
        </form>

        {busy && (
          <div className="runstrip" role="status">
            <span className="strong">
              Reading {selected.size} document
              {selected.size === 1 ? "" : "s"}. This usually takes 10 to 60
              seconds.
            </span>
            <div className="bar indet">
              <i />
            </div>
          </div>
        )}
        {error && (
          <div role="alert" className="alert">
            <Icon
              name="alert"
              color="var(--warn-ink)"
              style={{ flex: "none", marginTop: 3 }}
            />
            <div className="alert-body">{error}</div>
          </div>
        )}

        <div className="split">
          <div className="stack">
            {shown ? (
              <AnswerCard record={shown} documents={all} />
            ) : (
              !busy && (
                <section className="card pad" aria-label="Example questions">
                  <h2 className="section-h">Try one of these</h2>
                  <div className="chips">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="chip"
                        onClick={() => void submit(undefined, s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </section>
              )
            )}
          </div>

          <div className="stack sticky">
            <section
              className="card pad"
              aria-label="Documents searched"
              style={{ gap: 6 }}
            >
              <div className="card-head" style={{ marginBottom: 6 }}>
                <h2 className="section-h">Documents searched</h2>
                {scope !== null && (
                  <button
                    type="button"
                    className="rowbtn muted"
                    style={{ fontSize: 13 }}
                    onClick={() => setScope(null)}
                  >
                    Use all
                  </button>
                )}
              </div>
              {ready.length === 0 && (
                <span className="muted">No documents are ready yet.</span>
              )}
              {ready.map((d) => (
                <div key={d.id} className="check-row">
                  <input
                    id={`scope-${d.id}`}
                    type="checkbox"
                    className="check"
                    checked={selected.has(d.id)}
                    onChange={() => toggle(d.id)}
                  />
                  <label htmlFor={`scope-${d.id}`}>{docName(d.filename)}</label>
                  <span
                    className={selected.has(d.id) ? "mark-pass" : "muted"}
                    style={{ fontSize: 13, whiteSpace: "nowrap" }}
                  >
                    {selected.has(d.id) ? "In scope" : "Not used"}
                  </span>
                </div>
              ))}
            </section>

            <section
              className="card pad"
              aria-label="Saved answers"
              style={{ gap: 8 }}
            >
              <h2 className="section-h">Saved answers</h2>
              {earlierList.length === 0 && (
                <span className="muted" style={{ fontSize: 14 }}>
                  Your questions will appear here.
                </span>
              )}
              <div className="rows" style={{ margin: "0 -12px" }}>
                {earlierShown.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    aria-current={shown?.id === a.id ? "true" : undefined}
                    onClick={() => {
                      setShown(a);
                      setQuestion(a.question);
                      setError(null);
                    }}
                  >
                    <span className="row-title">{a.question}</span>
                    <span
                      className="row-sub"
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <i
                        aria-hidden="true"
                        style={{
                          width: 8,
                          height: 8,
                          flex: "none",
                          borderRadius: "50%",
                          background: STATUS_DOT[a.status] ?? "transparent",
                          border: STATUS_DOT[a.status]
                            ? 0
                            : "1.5px solid var(--muted)",
                        }}
                      />
                      {statusLabel(a.status)} · {when(a.createdAt)}
                    </span>
                  </button>
                ))}
              </div>
              {earlierList.length > 6 && (
                <button
                  type="button"
                  className="rowbtn"
                  style={{ fontSize: 14, fontWeight: 500 }}
                  onClick={() => setAllEarlier(!allEarlier)}
                >
                  {allEarlier ? "Show fewer" : `Show all ${earlierList.length}`}
                </button>
              )}
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
