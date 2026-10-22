import type { Fact } from "@kuki/types";
import type { SegmentView } from "@/lib/api";

// Finds where a fact sits in its page or sheet text, for the highlighter.

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export interface Highlight {
  range: [number, number];
  /** True when the quote wasn't verbatim and only the value is highlighted. */
  valueOnly: boolean;
}

/** Where to highlight: the quote (whitespace-insensitive), the cited cell, or the value. */
export function findHighlight(text: string, fact: Fact): Highlight | null {
  if (fact.locator.sheet && fact.locator.cell_range) {
    const first = fact.locator.cell_range.split(":")[0]!.replace(/\$/g, "");
    const at = text.search(new RegExp(`(^|[ |\\n])${escape(first)}=`));
    if (at < 0) return null;
    const start = text[at] === first[0] ? at : at + 1;
    const lineEnd = text.indexOf("\n", start);
    const tokenEnd = text.indexOf(" | ", start);
    const end =
      [lineEnd, tokenEnd].filter((i) => i >= 0).sort((a, b) => a - b)[0] ??
      text.length;
    return { range: [start, end], valueOnly: false };
  }
  if (!fact.quote) return null;
  const words = fact.quote.trim().split(/\s+/).map(escape);
  const match = new RegExp(words.join("\\s+"), "i").exec(text);
  if (match)
    return {
      range: [match.index, match.index + match[0].length],
      valueOnly: false,
    };

  // Tables put labels and values on different lines, so a quote can be
  // reassembled. Highlight the fact's own value, preferring the first
  // occurrence after its label.
  const lower = text.toLowerCase();
  const labelAt = Math.max(
    lower.indexOf(fact.label.toLowerCase()),
    lower.indexOf(fact.quote.split(/\s+\d/)[0]!.trim().toLowerCase()),
  );
  const pick = (
    hits: { index: number; length: number }[],
  ): Highlight | null => {
    const hit = hits.find((h) => h.index >= labelAt) ?? hits[0];
    return hit
      ? { range: [hit.index, hit.index + hit.length], valueOnly: true }
      : null;
  };
  if (fact.valueNumber !== null) {
    const target = Math.abs(fact.valueNumber);
    const numeric = pick(
      [...text.matchAll(/\d[\d,]*(?:\.\d+)?/g)]
        .filter(
          (m) => Math.abs(Number(m[0].replace(/,/g, "")) - target) < 0.005,
        )
        .map((m) => ({ index: m.index, length: m[0].length })),
    );
    if (numeric) return numeric;
  }
  // Text and dates: the value as written ("09-05-2024", "LT II (C)").
  const written = fact.valueText.trim().split(/\s+/).map(escape).join("\\s+");
  if (!written) return null;
  return pick(
    [...text.matchAll(new RegExp(written, "gi"))].map((m) => ({
      index: m.index,
      length: m[0].length,
    })),
  );
}

export function findSegment(fact: Fact, segments: SegmentView[]) {
  const { page, sheet, cell_range } = fact.locator;
  if (page) return segments.find((s) => s.locator.page === page);
  if (sheet) {
    const first = cell_range?.split(":")[0]?.replace(/\$/g, "");
    const onSheet = segments.filter((s) => s.locator.sheet === sheet);
    return (
      (first &&
        onSheet.find((s) =>
          new RegExp(`(^|[ |\\n])${escape(first)}=`).test(s.text),
        )) ||
      onSheet[0]
    );
  }
  return undefined;
}
