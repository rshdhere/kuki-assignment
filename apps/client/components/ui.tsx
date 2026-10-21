import type { ReactNode } from "react";
import { cn } from "@kuki/ui/lib/utils";
import { Icon } from "@/components/icon";
import type { JobState, Mark, Origin } from "@/lib/data";

type BadgeKind = "default" | "soft" | "calc" | "warn";

export function Badge({
  kind = "default",
  children,
}: {
  kind?: BadgeKind;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "badge",
        kind === "soft" && "badge-soft",
        kind === "calc" && "badge-calc",
        kind === "warn" && "badge-warn",
      )}
    >
      {children}
    </span>
  );
}

/** Reported values come from a document; calculated values come from KuKi. */
export function OriginBadge({ origin }: { origin: Origin }) {
  return <Badge kind={origin === "Calculated" ? "calc" : "default"}>{origin}</Badge>;
}

export function Status({
  state,
  label,
}: {
  state: JobState | "failed";
  label?: string;
}) {
  const text =
    label ??
    {
      succeeded: "Succeeded",
      extracting: "Extracting",
      retrying: "Retrying",
      duplicate: "Duplicate",
      failed: "Failed",
    }[state];
  return (
    <span className="status">
      {state === "succeeded" && (
        <Icon name="check-circle" color="var(--ok)" />
      )}
      {state === "extracting" && (
        <Icon name="loader" color="var(--calc)" className="spin" />
      )}
      {state === "retrying" && <CountdownRing />}
      {state === "duplicate" && (
        <Icon name="minus-circle" color="var(--line-2)" />
      )}
      {state === "failed" && <Icon name="x" color="var(--bad)" />}
      {text}
    </span>
  );
}

/** Drains once per retry window. Loops only while a retry is pending. */
export function CountdownRing() {
  return (
    <svg
      className="countdown"
      width={16}
      height={16}
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <circle
        cx="8"
        cy="8"
        r="7"
        fill="none"
        stroke="var(--warn-line)"
        strokeWidth="2"
      />
      <circle
        className="prog"
        cx="8"
        cy="8"
        r="7"
        fill="none"
        stroke="var(--warn)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MarkLabel({ mark, change }: { mark: Mark; change?: string }) {
  return (
    <span className="status">
      {mark === "pass" && <Icon name="check" size={14} color="var(--ok)" />}
      {mark === "fail" && <Icon name="x" size={14} color="var(--bad)" />}
      {mark === "partial" && (
        <Icon name="minus-circle" size={14} color="var(--warn)" />
      )}
      {mark === "pass" ? "Pass" : mark === "fail" ? "Fail" : "Partial"}
      {change && (
        <span className={change === "fixed" ? "chip-ok" : "chip-bad"}>
          {change}
        </span>
      )}
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
  top,
  children,
  muted,
}: {
  label: string;
  value: string;
  unit?: string;
  foot?: string;
  top?: ReactNode;
  children?: ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="card pad lift" style={{ gap: 8 }}>
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {top}
      </div>
      <div className="stat" style={muted ? { color: "var(--muted)" } : undefined}>
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

export function FilterButton({ children }: { children: ReactNode }) {
  return (
    <button type="button" className="btn btn-dashed">
      <Icon name="plus-circle" size={14} />
      {children}
    </button>
  );
}
