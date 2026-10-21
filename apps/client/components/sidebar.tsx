"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icon";
import { MotionSwitch } from "@/components/motion-switch";

const nav: { href: string; label: string; icon: IconName; count?: string }[] = [
  { href: "/", label: "Documents", icon: "doc", count: "7" },
  { href: "/facts", label: "Extracted facts", icon: "table" },
  { href: "/ask", label: "Ask", icon: "message" },
  { href: "/financial-year", label: "Financial year", icon: "calendar" },
  { href: "/evaluation", label: "Evaluation", icon: "flask" },
];

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

      <button type="button" className="search">
        <Icon name="search" size={15} />
        <span>Search</span>
        <kbd className="kbd">⌘K</kbd>
      </button>

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
