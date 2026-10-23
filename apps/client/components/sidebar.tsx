"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { CommandPalette } from "@/components/command-palette";
import { Logo } from "@/components/logo";
import { closeMobileSidebar } from "@/components/sidebar-toggle";
import { api } from "@/lib/api";
import { nav } from "@/lib/nav";
import { usePoll } from "@/lib/use-poll";

export function Sidebar() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname.startsWith(href);
  // Refreshed on each navigation, so the count stays close without its own timer.
  const docs = usePoll(api.documents, 0, pathname);
  const count = docs.data?.filter((d) => d.status !== "duplicate").length;

  // On phones the sidebar is a drawer; close it after navigating.
  useEffect(() => closeMobileSidebar(), [pathname]);

  return (
    <>
      <aside id="sidebar" className="side" aria-label="Sidebar">
        <Link href="/financial-year" className="ws">
          <Logo />
          <span className="ws-name">
            <b>KuKi</b>
            <span>Sustainability data</span>
          </span>
        </Link>

        <CommandPalette />

        <nav className="nav" aria-label="Workspace">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="nav-item"
              aria-current={isActive(item.href) ? "page" : undefined}
            >
              {item.label}
              {item.href === "/documents" && count ? (
                <span className="nav-count">{count}</span>
              ) : null}
            </Link>
          ))}
        </nav>

        <div className="side-foot">
          <p className="side-note">
            KuKi reads your bills, spreadsheets and records, and keeps every
            number linked to the page it came from.
          </p>
        </div>
      </aside>
      <button
        type="button"
        className="side-backdrop"
        aria-label="Close menu"
        tabIndex={-1}
        onClick={closeMobileSidebar}
      />
    </>
  );
}
