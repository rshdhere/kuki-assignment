"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { CommandPalette } from "@/components/command-palette";
import { Icon } from "@/components/icon";
import { closeMobileSidebar } from "@/components/sidebar-toggle";
import { nav } from "@/lib/nav";

export function Sidebar() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  // On phones the sidebar is a drawer; close it after navigating.
  useEffect(() => closeMobileSidebar(), [pathname]);

  return (
    <>
      <aside id="sidebar" className="side" aria-label="Sidebar">
        <Link href="/" className="ws">
          <span className="logo">
            <span>K</span>
          </span>
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
              <Icon name={item.icon} />
              {item.label}
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
