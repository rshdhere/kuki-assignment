import type { DocumentStatus } from "@kuki/types";

const nf = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

export const num = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : nf.format(n);

const monthYear = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const dayMonthYear = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export const date = (iso: string | null | undefined) =>
  iso ? dayMonthYear.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`)) : "—";

/** "Apr 2024", "1 Jun – 1 Jul 2024", "Jan – Dec 2026". */
export function period(start: string | null, end: string | null) {
  if (!start && !end) return "—";
  if (!start || !end) return date(start ?? end);
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  const lastDay = new Date(
    Date.UTC(e.getUTCFullYear(), e.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const wholeMonths = s.getUTCDate() === 1 && e.getUTCDate() === lastDay;
  if (wholeMonths) {
    const a = monthYear.format(s);
    const b = monthYear.format(e);
    return a === b ? a : `${a} – ${b}`;
  }
  return start === end ? date(start) : `${date(start)} – ${date(end)}`;
}

/** Indian financial year label for a date, e.g. "2024-25". */
export function fyOf(iso: string | null) {
  if (!iso) return null;
  const [y, m] = iso.split("-").map(Number);
  if (!y || !m) return null;
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export const docTypeLabel = (t: string | null) =>
  t
    ? ({
        electricity_bill: "Electricity bill",
        water_bill: "Water bill",
        consumption_workbook: "Spreadsheet",
        waste_record: "Waste record",
        policy: "Policy",
        other: "Other",
      }[t] ?? t)
    : null;

export const bytes = (n: number) =>
  n < 1024 * 1024
    ? `${Math.ceil(n / 1024)} KB`
    : `${(n / 1048576).toFixed(1)} MB`;

export const shortHash = (sha: string) => `${sha.slice(0, 4)}…${sha.slice(-3)}`;

export const isActive = (s: DocumentStatus) =>
  s === "queued" ||
  s === "extracting" ||
  s === "retrying" ||
  s === "awaiting_upload";

export const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour12: false });

export const statusLabel = (s: string) =>
  ({
    answered: "Answered",
    partial: "Partly answered",
    insufficient_evidence: "Not in the documents",
    conflicting_evidence: "Documents disagree",
  })[s] ?? s;

/** Status in everyday words. */
export const statusText: Record<DocumentStatus, string> = {
  awaiting_upload: "Uploading",
  queued: "Waiting to be read",
  extracting: "Reading",
  retrying: "Trying again",
  succeeded: "Ready",
  failed: "Couldn't be read",
  duplicate: "Already uploaded",
};

/** Why a document failed or is retrying, without system details. */
export function problemText(status: DocumentStatus, error: string | null) {
  if (status === "retrying")
    return "A temporary problem interrupted reading. KuKi will try again automatically.";
  if (status !== "failed") return null;
  if (error && /read|open|unsupported|password|stream/i.test(error))
    return "This file couldn't be opened. It may be damaged or password-protected. Try uploading it again.";
  return "KuKi tried several times and couldn't read this file. Try uploading it again.";
}

/** "Page 1", or "Monthly Summary 2026, cell F16". */
export function placeText(locator: {
  page?: number | null;
  sheet?: string | null;
  cell_range?: string | null;
}) {
  if (locator.sheet) {
    const range = locator.cell_range;
    if (!range) return `Sheet “${locator.sheet}”`;
    return `${locator.sheet}, ${range.includes(":") ? "cells" : "cell"} ${range}`;
  }
  return locator.page ? `Page ${locator.page}` : "Whole document";
}

/** Fact categories grouped under plain headings, in reading order. */
export const factGroups: { title: string; categories: string[] }[] = [
  { title: "Usage", categories: ["consumption", "quantity"] },
  { title: "Amounts and charges", categories: ["amount"] },
  { title: "Meter readings", categories: ["meter_reading"] },
  { title: "Rates", categories: ["rate"] },
  { title: "Dates and periods", categories: ["period", "date"] },
  { title: "Who and which account", categories: ["party", "identifier"] },
  {
    title: "Policy scope and commitments",
    categories: ["scope", "commitment"],
  },
  { title: "Other details", categories: ["other"] },
];

/** A file name as a readable title: "water_bill_invoice.pdf" → "Water bill invoice". */
export function docName(filename: string) {
  const base = filename
    .replace(/(\.(docx?|pdf|xlsx|csv))+$/i, "")
    .replace(/[_]+/g, " ")
    .trim();
  return base.charAt(0).toUpperCase() + base.slice(1);
}
