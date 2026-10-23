import type { ReactNode } from "react";
import { cn } from "@kuki/ui/lib/utils";
import { Icon } from "@/components/icon";
import type { DocumentStatus, FactOrigin } from "@kuki/types";
import type { Mark } from "@/lib/api";
import { statusText } from "@/lib/format";

type BadgeKind = "default" | "soft" | "calc" | "warn" | "ok" | "bad";

export function Badge({
  kind = "default",
  children,
}: {
  kind?: BadgeKind;
  children: ReactNode;
}) {
  return (
    <span className={cn("badge", kind !== "default" && `badge-${kind}`)}>
      {children}
    </span>
  );
}

/** Reported values come from a document; calculated values come from KuKi. */
export function OriginBadge({ origin }: { origin: FactOrigin }) {
  return (
    <Badge kind={origin === "calculated" ? "calc" : "default"}>
      {origin === "calculated" ? "Calculated" : "Reported"}
    </Badge>
  );
}

const TONE: Record<DocumentStatus, string> = {
  awaiting_upload: "run",
  queued: "",
  extracting: "run",
  retrying: "warn",
  succeeded: "ok",
  failed: "bad",
  duplicate: "",
};

/** A document's state as a coloured chip: green ready, blue working, amber retrying, red failed. */
export function Status({
  state,
  label,
}: {
  state: DocumentStatus;
  label?: string;
}) {
  return (
    <span className={cn("chip-state", TONE[state])}>
      {(state === "extracting" || state === "awaiting_upload") && (
        <Icon name="loader" size={12} strokeWidth={3} className="spin" />
      )}
      {state === "retrying" && <CountdownRing />}
      {label ?? statusText[state]}
    </span>
  );
}

/** Drains once per retry window. Loops only while a retry is pending. */
export function CountdownRing() {
  return (
    <svg
      className="countdown"
      width={12}
      height={12}
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <circle
        cx="8"
        cy="8"
        r="7"
        fill="none"
        stroke="var(--warn-line)"
        strokeWidth="2.5"
      />
      <circle
        className="prog"
        cx="8"
        cy="8"
        r="7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

const MARK_TEXT: Record<Mark, string> = {
  pass: "Pass",
  fail: "Fail",
  partial: "Partial",
  error: "No answer",
};

export function MarkLabel({ mark, change }: { mark: Mark; change?: string }) {
  return (
    <span
      className={cn(
        "status",
        mark === "pass" && "mark-pass",
        mark === "partial" && "mark-partial",
        (mark === "fail" || mark === "error") && "mark-fail",
      )}
    >
      {MARK_TEXT[mark]}
      {change && (
        <span className={change === "fixed" ? "chip-ok" : "chip-bad"}>
          {change === "fixed" ? "Fixed" : "Regressed"}
        </span>
      )}
    </span>
  );
}

/** A check result: a drawn tick or warning, then its words. */
export function Verdict({
  ok,
  children,
}: {
  ok: boolean;
  children: ReactNode;
}) {
  return (
    <span className={cn("status", ok ? "mark-pass" : "mark-partial")}>
      <Icon name={ok ? "check" : "alert"} size={14} strokeWidth={2.5} />
      {children}
    </span>
  );
}

export function PageHeading({
  title,
  lede,
  aside,
}: {
  title: string;
  lede?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="head">
      <div className="head-text">
        <h1 className="title">{title}</h1>
        {lede && <p className="lede">{lede}</p>}
      </div>
      {aside}
    </div>
  );
}

export function StatCard({
  label,
  value,
  unit,
  foot,
  tag,
  tone,
  children,
}: {
  label: string;
  value: string;
  unit?: string;
  foot?: string;
  /** A short dark pill in the top corner naming what the number is about. */
  tag?: string;
  /** `hl` marks the one number to watch; `bad` marks failures. */
  tone?: "hl" | "bad";
  children?: ReactNode;
}) {
  return (
    <div className={cn("stat-card", tone)}>
      <div className="stat-top">
        <span>{label}</span>
        {tag && <span className="tag">{tag}</span>}
      </div>
      <div className="stat">
        {value}
        {unit && <small> {unit}</small>}
      </div>
      {children}
      {foot && <div className="stat-foot">{foot}</div>}
    </div>
  );
}

export function CardHead({ title, desc }: { title: string; desc?: string }) {
  return (
    <div>
      <h2 className="card-h">{title}</h2>
      {desc && <p className="card-d">{desc}</p>}
    </div>
  );
}
