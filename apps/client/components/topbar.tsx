import Link from "next/link";
import type { ReactNode } from "react";
import { SidebarToggle } from "@/components/sidebar-toggle";

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
      <SidebarToggle />
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
