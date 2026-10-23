"use client";

import type { AnswerRecord } from "@kuki/types";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnswerCard } from "@/components/answer-card";
import { Icon } from "@/components/icon";
import { Logo } from "@/components/logo";
import { Thinking } from "@/components/thinking";
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

// Read in event handlers only; the compiler can't tell submit isn't called in render.
const clock = () => Date.now();

type Turn = {
  key: number;
  question: string;
  docs: number;
  startedAt: number;
  tookMs?: number;
  record: AnswerRecord | null;
  error: string | null;
};

export function AskView() {
  const docs = usePoll(api.documents);
  const earlier = usePoll(api.answers);
  const all = docs.data ?? [];
  const ready = all.filter((d) => d.status === "succeeded");
  const pending = all.filter((d) => isActive(d.status)).length;

  // null means every ready document.
  const [scope, setScope] = useState<Set<string> | null>(null);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [allEarlier, setAllEarlier] = useState(false);
  const earlierList = earlier.data ?? [];
  const earlierShown = allEarlier ? earlierList : earlierList.slice(0, 6);
  const busy = turns.some((t) => t.tookMs === undefined);
  const latest = useRef<HTMLDivElement>(null);
  const shownId = turns.length === 1 ? turns[0]!.record?.id : undefined;

  const selected = scope ?? new Set(ready.map((d) => d.id));
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setScope(next);
  };

  // Bring each new question to the top of the view as it is asked.
  const lastKey = turns.at(-1)?.key;
  useEffect(() => {
    latest.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [lastKey]);

  const patch = (key: number, next: Partial<Turn>) =>
    setTurns((ts) => ts.map((t) => (t.key === key ? { ...t, ...next } : t)));

  const submit = async (e?: FormEvent, text = question) => {
    e?.preventDefault();
    const q = text.trim();
    if (!q || busy || selected.size === 0) return;
    const startedAt = clock();
    const key = startedAt;
    setQuestion("");
    setTurns((ts) => [
      ...ts,
      {
        key,
        question: q,
        docs: selected.size,
        startedAt,
        record: null,
        error: null,
      },
    ]);
    try {
      const record = await api.ask(q, scope === null ? [] : [...scope]);
      patch(key, { record, tookMs: clock() - startedAt });
      void earlier.refresh();
    } catch {
      patch(key, {
        error: "KuKi couldn't answer just now. Try again in a moment.",
        tookMs: clock() - startedAt,
      });
    }
  };

  const retry = (t: Turn) => {
    setTurns((ts) => ts.filter((x) => x.key !== t.key));
    void submit(undefined, t.question);
  };

  const startOver = () => {
    setTurns([]);
    setQuestion("");
  };

  const composer = (
    <form
      onSubmit={(e) => void submit(e)}
      className={turns.length ? "dock" : undefined}
      style={{ display: "flex", flexDirection: "column", gap: 10 }}
    >
      <div className="composer">
        {turns.length === 0 && (
          <Icon
            name="search"
            size={20}
            style={{ flex: "none", alignSelf: "center" }}
          />
        )}
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
          placeholder={
            turns.length
              ? "Ask another question"
              : "How much water was used in December 2025?"
          }
        />
        {turns.length ? (
          <button
            type="submit"
            className="btn btn-primary send"
            aria-label={busy ? "Working on the answer" : "Send question"}
            disabled={busy || !question.trim() || selected.size === 0}
          >
            {busy ? (
              <Icon name="loader" size={18} className="spin" />
            ) : (
              <Icon name="arrow-up" size={18} />
            )}
          </button>
        ) : (
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!question.trim() || selected.size === 0}
          >
            Get answer
          </button>
        )}
      </div>
      <span className="muted" style={{ fontSize: 13, paddingLeft: 4 }}>
        Looking in {selected.size} of {ready.length} processed document
        {ready.length === 1 ? "" : "s"}
        {pending > 0 && ` · ${pending} still processing`}
        {turns.length > 0 && " · each question is answered on its own"}
      </span>
    </form>
  );

  return (
    <>
      <Topbar
        crumbs={[{ label: "Ask" }]}
        actions={
          turns.length > 0 &&
          !busy && (
            <button type="button" className="btn" onClick={startOver}>
              <Icon name="plus" />
              New question
            </button>
          )
        }
      />
      <main className={turns.length ? "page page-thread" : "page"}>
        {turns.length === 0 && (
          <>
            <PageHeading
              title="Ask"
              lede="Ask about usage, amounts, policies or a financial year. Every answer shows where in your documents it comes from."
            />
            {composer}
          </>
        )}

        <div className="split">
          <div className="stack">
            {turns.length === 0 ? (
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
            ) : (
              <div className="thread">
                {turns.map((t, i) => (
                  <div
                    key={t.key}
                    ref={i === turns.length - 1 ? latest : undefined}
                    className="turn"
                  >
                    <p className="turn-q">{t.question}</p>
                    <div className="turn-a">
                      <span className="turn-avatar">
                        <Logo size={22} />
                      </span>
                      <div className="stack" style={{ flex: 1, gap: 16 }}>
                        {t.startedAt > 0 && (
                          <Thinking
                            docs={t.docs}
                            startedAt={t.startedAt}
                            tookMs={t.tookMs}
                          />
                        )}
                        {t.error && (
                          <div role="alert" className="alert">
                            <Icon
                              name="alert"
                              color="var(--warn-ink)"
                              style={{ flex: "none", marginTop: 3 }}
                            />
                            <div className="alert-body">{t.error}</div>
                            <button
                              type="button"
                              className="btn btn-sm"
                              style={{ marginLeft: "auto" }}
                              disabled={busy}
                              onClick={() => retry(t)}
                            >
                              Try again
                            </button>
                          </div>
                        )}
                        {t.record && (
                          <div className="turn-answer">
                            <AnswerCard
                              record={t.record}
                              documents={all}
                              hideQuestion
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {composer}
              </div>
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
                    aria-current={shownId === a.id ? "true" : undefined}
                    disabled={busy}
                    onClick={() =>
                      setTurns([
                        {
                          key: Date.now(),
                          question: a.question,
                          docs: a.documentIds.length,
                          startedAt: 0,
                          tookMs: 0,
                          record: a,
                          error: null,
                        },
                      ])
                    }
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
