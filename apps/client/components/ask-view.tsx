"use client";

import type { AnswerRecord } from "@kuki/types";
import { useState, type FormEvent } from "react";
import { AnswerCard } from "@/components/answer-card";
import { Icon } from "@/components/icon";
import { Topbar } from "@/components/topbar";
import { PageHeading } from "@/components/ui";
import { api } from "@/lib/api";
import { docName, statusLabel } from "@/lib/format";
import { usePoll } from "@/lib/use-poll";

const SUGGESTIONS = [
  "What electricity consumption does each bill report, and for which period?",
  "Does the water consumption match the meter readings?",
  "What total waste quantity is recorded?",
  "Do the spreadsheet's monthly values and annual totals agree?",
  "Does the quality policy set a deadline for resolving customer complaints?",
  "What was the total electricity consumption in FY 2024-25?",
];

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
  const ready = (docs.data ?? []).filter((d) => d.status === "succeeded");

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
        crumbs={[{ label: "Ask a question" }]}
        actions={
          shown && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={startOver}
            >
              <Icon name="plus" />
              New question
            </button>
          )
        }
      />
      <main className="page">
        <PageHeading
          title="Ask a question"
          lede="Ask about usage, amounts, policies or a financial year. Every answer shows where in your documents it comes from."
        />

        <div className="split">
          <div className="stack">
            <form className="card composer" onSubmit={(e) => void submit(e)}>
              <label htmlFor="ask" className="sr">
                Your question
              </label>
              <textarea
                id="ask"
                rows={3}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void submit();
                  }
                }}
                placeholder="For example: how much water was used in December 2025?"
              />
              <div className="card-head">
                <span className="muted" style={{ fontSize: 13 }}>
                  Using {selected.size} of {ready.length} documents
                </span>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={busy || !question.trim() || selected.size === 0}
                >
                  {busy ? "Reading…" : "Ask"}
                </button>
              </div>
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
                  color="var(--warn)"
                  style={{ flex: "none", marginTop: 2 }}
                />
                <div className="alert-body">{error}</div>
              </div>
            )}

            {shown ? (
              <AnswerCard record={shown} documents={docs.data ?? []} />
            ) : (
              !busy && (
                <section className="card pad" aria-label="Example questions">
                  <h2 className="section-h">
                    Not sure what to ask? Try one of these
                  </h2>
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
            <section className="card pad" aria-label="Documents to use">
              <div>
                <h2 className="section-h">Documents to use</h2>
                <p className="section-d">
                  Answers only use the ticked documents.
                </p>
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
                </div>
              ))}
            </section>

            <section
              className="card pad"
              aria-label="Earlier questions"
              style={{ gap: 8 }}
            >
              <h2 className="section-h">Earlier questions</h2>
              {(earlier.data ?? []).length === 0 && (
                <span className="muted">Your questions will appear here.</span>
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
                    <span className="row-sub">
                      {statusLabel(a.status)}, {when(a.createdAt)}
                    </span>
                  </button>
                ))}
              </div>
              {earlierList.length > 6 && (
                <button
                  type="button"
                  className="rowbtn"
                  style={{ fontSize: 13, fontWeight: 500 }}
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
