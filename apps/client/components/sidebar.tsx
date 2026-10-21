"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CommandPalette } from "@/components/command-palette";
import { Icon } from "@/components/icon";
import { MotionSwitch } from "@/components/motion-switch";
import { nav } from "@/lib/nav";

const recent: Record<string, { title: string; items: string[] }> = {
  "/ask": {
    title: "Earlier questions",
    items: [
      "Workbook monthly vs annual",
      "Water usage vs meter readings",
      "Total waste recorded",
      "Complaint resolution deadline",
    ],
  },
  "/evaluation": {
    title: "Runs",
    items: ["r_02 · improved", "r_01 · baseline"],
  },
};

const recentDocuments = {
  title: "Recent",
  items: [
    "Adani commercial electricity bill",
    "BESCOM Commercial Electricity Bill",
    "Annual Electricity Consumption",
  ],
};

export function Sidebar() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);
  const list =
    recent[pathname] ??
    (pathname === "/financial-year" ? null : recentDocuments);

  return (
    <aside className="side" aria-label="Sidebar">
      <button type="button" className="ws">
        <span className="logo">
          <span>K</span>
        </span>
        <span className="ws-name">
          <b>KuKi</b>
          <span>Sustainability data</span>
        </span>
        <Icon name="chevrons" />
      </button>

      <CommandPalette />

      <nav className="nav" aria-label="Workspace">
        <div className="nav-label">Workspace</div>
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="nav-item"
            aria-current={isActive(item.href) ? "page" : undefined}
          >
            <Icon name={item.icon} />
            {item.label}
            {item.count && <span className="count">{item.count}</span>}
          </Link>
        ))}
      </nav>

      {list && (
        <nav className="nav" aria-label={list.title}>
          <div className="nav-label">{list.title}</div>
          {list.items.map((item, i) => (
            <a
              key={item}
              href="#"
              className="recent"
              aria-current={i === 0 && pathname !== "/" ? "page" : undefined}
            >
              {item}
            </a>
          ))}
        </nav>
      )}

      <div className="side-foot">
        <MotionSwitch />
        <div className="who">
          <span className="avatar">DU</span>
          <span className="who-name">
            <b>Demo user</b>
            <span>Private workspace</span>
          </span>
        </div>
      </div>
    </aside>
  );
}
