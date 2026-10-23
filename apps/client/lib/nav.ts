import type { IconName } from "@/components/icon";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  /** One line shown under the page title in the command palette. */
  hint: string;
}

/** Dashboard screens, shared by the sidebar and the command palette. */
export const nav: NavItem[] = [
  {
    href: "/documents",
    label: "Documents",
    icon: "doc",
    hint: "Upload files and follow their progress",
  },
  {
    href: "/facts",
    label: "Extracted facts",
    icon: "table",
    hint: "Every value found, with where it came from",
  },
  {
    href: "/ask",
    label: "Ask",
    icon: "message",
    hint: "Ask questions, get answers with sources",
  },
  {
    href: "/financial-year",
    label: "Financial year",
    icon: "calendar",
    hint: "Totals for an April–March year",
  },
  {
    href: "/evaluation",
    label: "Evaluation",
    icon: "flask",
    hint: "How KuKi was tested, and how it scored",
  },
];
