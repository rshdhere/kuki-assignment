import type { IconName } from "@/components/icon";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  count?: string;
}

/** Dashboard screens, shared by the sidebar and the command palette. */
export const nav: NavItem[] = [
  { href: "/", label: "Documents", icon: "doc", count: "7" },
  { href: "/facts", label: "Extracted facts", icon: "table" },
  { href: "/ask", label: "Ask", icon: "message" },
  { href: "/financial-year", label: "Financial year", icon: "calendar" },
  { href: "/evaluation", label: "Evaluation", icon: "flask" },
];
