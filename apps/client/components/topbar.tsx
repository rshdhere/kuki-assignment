import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/icon";

export interface Crumb {
  label: string;
  href?: string;
}

export function Topbar({
  crumbs,
  actions,
}: {
  crumbs: Crumb[];
  actions?: ReactNode;
}) {
  return (
    <header className="topbar">
      <button type="button" className="icon-btn" aria-label="Toggle sidebar">
        <Icon name="panel" />
      </button>
      <span className="vsep" />
      <nav className="crumbs" aria-label="Breadcrumb">
        <span>KuKi</span>
        {crumbs.map((c, i) => (
          <span key={c.label} style={{ display: "contents" }}>
            <span aria-hidden="true">/</span>
            {c.href && i < crumbs.length - 1 ? (
              <Link href={c.href}>{c.label}</Link>
            ) : (
              <span className="here">{c.label}</span>
            )}
          </span>
        ))}
      </nav>
      {actions && <div className="actions">{actions}</div>}
    </header>
  );
}
