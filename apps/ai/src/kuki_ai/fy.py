"""Indian financial year (1 April to 31 March) selection, totals and coverage.

This is deterministic on purpose: the model decides which question is being
asked, but which records fall in a year, how partial periods are prorated and
how complete the coverage is are computed here.
"""

import calendar
import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, timedelta

from kuki_ai.schemas import DocumentContext, Fact, FinancialYearSummary, FyGroup, FyRecord

FY_MONTHS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"]
QUANTITY_CATEGORIES = {"consumption", "quantity"}


@dataclass(frozen=True)
class FinancialYear:
    start_year: int
    assumption: str | None = None

    @property
    def label(self) -> str:
        return f"FY {self.start_year}-{(self.start_year + 1) % 100:02d}"

    @property
    def start(self) -> date:
        return date(self.start_year, 4, 1)

    @property
    def end(self) -> date:
        return date(self.start_year + 1, 3, 31)

    @property
    def days(self) -> int:
        return (self.end - self.start).days + 1


def _year(token: str) -> int:
    return int(token) + 2000 if len(token) == 2 else int(token)


def parse_fy(text: str) -> FinancialYear | None:
    """Finds an Indian FY in free text: 'FY 2024-25', '2024-2025', 'FY25', 'FY 2025'."""
    match = re.search(r"\b(?:FY\s*'?)?(\d{4}|\d{2})\s*[-–/]\s*(\d{4}|\d{2})\b", text, re.I)
    if match:
        a, b = _year(match[1]), _year(match[2])
        if b == a + 1:
            return FinancialYear(a)
    match = re.search(r"\bFY\s*'?(\d{4}|\d{2})\b", text, re.I)
    if match:
        end = _year(match[1])
        return FinancialYear(
            end - 1,
            f"Read 'FY{match[1]}' as the year ending 31 March {end} "
            f"(FY {end - 1}-{end % 100:02d}), the usual Indian convention.",
        )
    return None


def _date(value: str | None) -> date | None:
    try:
        return date.fromisoformat(value) if value else None
    except ValueError:
        return None


def _days(a: date, b: date) -> int:
    return (b - a).days + 1


def _month_starts(fy: FinancialYear):
    for i in range(12):
        year = fy.start_year + (1 if i >= 9 else 0)
        month = (i + 3) % 12 + 1
        yield (
            FY_MONTHS[i],
            date(year, month, 1),
            date(year, month, calendar.monthrange(year, month)[1]),
        )


# Units that can be added up over time: energy, volume, mass, money. Rates,
# demand (kVA, kW), percentages and per-day figures can't.
_ADDITIVE_UNIT = re.compile(
    r"^(?:[kmg]?wh|[kmg]?vah|r?k?varh|rkvah|kl|ml|l|litres?|liters?|m3|m³|cu\.?m|"
    r"cubicmeters?|cubicmetres?|t|mt|tonnes?|tons?|kg|inr|rs|₹)$"
)
# Statistics about a series rather than amounts in a period.
_STATISTIC = re.compile(
    r"highest|lowest|average|\bavg|\bmean\b|\bmax|\bmin|\bbest|peak.to|per.day|"
    r"\bratio|factor|percent|\bshare\b|demand|capacity|reading",
    re.I,
)
# Records longer than a quarter that cross the year boundary are summaries
# (annual totals); prorating them would invent monthly values.
MAX_PRORATED_DAYS = 92


def unit_key(unit: str | None) -> str:
    return re.sub(r"[\s.]", "", (unit or "").lower())


def _metric_matches(fact: Fact, metric: str | None) -> bool:
    if metric:
        return fact.metric == metric
    # Money is only totalled when asked for: bills carry several overlapping amounts.
    return fact.metric != "cost" and fact.category in QUANTITY_CATEGORIES


def _additive(fact: Fact) -> bool:
    """Only reported amounts over a period, in a unit that can be summed."""
    text = f"{fact.key} {fact.label} {fact.series or ''}"
    return (
        fact.origin == "reported"
        and bool(_ADDITIVE_UNIT.match(unit_key(fact.unit)))
        and not _STATISTIC.search(text.replace("_", " "))
    )


def summarise(
    documents: list[DocumentContext],
    fy: FinancialYear,
    metric: str | None = None,
    today: date | None = None,
) -> FinancialYearSummary:
    today = today or date.today()
    notes: list[str] = [fy.assumption] if fy.assumption else []
    groups: list[FyGroup] = []
    without_overlap: list[str] = []

    for doc in documents:
        candidates: dict[tuple, list[tuple[Fact, date, date]]] = defaultdict(list)
        for fact in doc.facts:
            start, end = _date(fact.period_start), _date(fact.period_end)
            if (
                fact.value_number is None
                or start is None
                or end is None
                or end < start
                or not _metric_matches(fact, metric)
                or not _additive(fact)
            ):
                continue
            # Without a named series, each fact key is its own series, so two
            # different figures for the same period (net vs gross, two amounts)
            # are never treated as interchangeable.
            series = fact.series or fact.key
            candidates[(fact.metric or "other", series, unit_key(fact.unit))].append(
                (fact, start, end)
            )

        doc_groups = 0
        long_records: list[str] = []
        future_starts: set[str] = set()
        prorated_any = False
        doc_start = len(groups)
        for (fact_metric, series, _unit), facts in candidates.items():
            unit = facts[0][0].unit
            in_year = [(f, s, e) for f, s, e in facts if s <= fy.end and e >= fy.start]
            if not in_year:
                continue
            # Prefer the finest-grained records and drop anything overlapping
            # them, so monthly rows win over quarterly or annual totals.
            in_year.sort(key=lambda t: (_days(t[1], t[2]), t[1]))
            chosen: list[tuple[Fact, date, date]] = []
            excluded: list[str] = []
            for f, s, e in in_year:
                partial = s < fy.start or e > fy.end
                if partial and _days(s, e) > MAX_PRORATED_DAYS:
                    long_records.append(f.label)
                    continue
                # Only a strictly finer record wins: entries with the same
                # period (four waste loads on one day) are separate amounts.
                clash = next(
                    (
                        c
                        for c in chosen
                        if s <= c[2] and e >= c[1] and _days(c[1], c[2]) < _days(s, e)
                    ),
                    None,
                )
                if clash:
                    excluded.append(
                        f"{f.label} ({f.value_text}) covers the same time as {clash[0].label}, "
                        "so it wasn't counted twice"
                    )
                else:
                    chosen.append((f, s, e))
            if not chosen:
                continue
            chosen.sort(key=lambda t: t[1])

            records: list[FyRecord] = []
            covered: set[date] = set()
            for f, s, e in chosen:
                lo, hi = max(s, fy.start), min(e, fy.end)
                overlap, length = _days(lo, hi), _days(s, e)
                included = f.value_number * overlap / length
                covered.update(lo + timedelta(days=i) for i in range(overlap))
                records.append(
                    FyRecord(
                        document_id=doc.id,
                        filename=doc.filename,
                        fact_key=f.key,
                        label=f.label,
                        value=f.value_number,
                        unit=f.unit,
                        period_start=f.period_start,
                        period_end=f.period_end,
                        overlap_days=overlap,
                        period_days=length,
                        included_value=round(included, 4),
                        prorated=overlap < length,
                        locator_label=f.locator.label(),
                    )
                )
            months_covered, months_missing = [], []
            for name, m_start, m_end in _month_starts(fy):
                days = _days(m_start, m_end)
                have = sum(1 for i in range(days) if m_start + timedelta(days=i) in covered)
                (months_covered if have == days else months_missing).append(name)
                if 0 < have < days:
                    notes.append(
                        f"{doc.filename}: {calendar.month_name[m_start.month]} is only partly "
                        f"covered ({have} of {days} days)."
                    )
            future_starts.update(
                r.period_start for r in records if date.fromisoformat(r.period_end) > today
            )
            prorated_any = prorated_any or any(r.prorated for r in records)
            groups.append(
                FyGroup(
                    organisation=doc.organisation,
                    document_id=doc.id,
                    filename=doc.filename,
                    metric=fact_metric,
                    series=series,
                    unit=unit,
                    total=round(sum(r.included_value for r in records), 4),
                    covered_days=len(covered),
                    fy_days=fy.days,
                    coverage_pct=round(100 * len(covered) / fy.days, 1),
                    months_covered=months_covered,
                    months_missing=months_missing,
                    records=records,
                    excluded=excluded,
                )
            )
            doc_groups += 1
        if future_starts:
            notes.append(
                f"{doc.filename}: figures from {date_text(min(future_starts))} onwards are for "
                f"periods that hadn't ended by {date_text(today.isoformat())}. They are counted "
                "as printed, but treat them as provisional."
            )
        if prorated_any:
            notes.append(
                f"{doc.filename}: some figures cover a period that crosses 1 April or 31 March. "
                "Only the share of days inside this year was counted."
            )
        if long_records:
            examples = ", ".join(sorted(set(long_records))[:2])
            notes.append(
                f"{doc.filename}: yearly or seasonal totals (such as {examples}) run past the start "
                "or end of this year, so they were left out; the monthly figures were used instead."
            )
        groups[doc_start:] = _merge_restatements(groups[doc_start:])
        if doc_groups == 0:
            without_overlap.append(doc.filename)

    return FinancialYearSummary(
        fy=fy.label,
        start=fy.start.isoformat(),
        end=fy.end.isoformat(),
        metric=metric,
        groups=groups,
        combined=_combine(groups, notes),
        notes=list(dict.fromkeys(notes)),
        documents_without_overlap=without_overlap,
    )


def _merge_restatements(groups: list[FyGroup]) -> list[FyGroup]:
    """Folds groups that restate the same figure for the same days into one.

    A bill often prints its consumption several times (consumption, net
    consumption, the quantity an energy charge is billed on). They are one
    amount, so they are shown once, with the restatements listed.
    """
    kept: list[FyGroup] = []
    for g in groups:
        twin = next(
            (
                k
                for k in kept
                if unit_key(k.unit) == unit_key(g.unit)
                and abs(k.total - g.total) < 0.005
                and [(r.period_start, r.period_end) for r in k.records]
                == [(r.period_start, r.period_end) for r in g.records]
            ),
            None,
        )
        if twin:
            twin.excluded.append(
                f"Also printed as {g.records[0].label} ({g.total:g} {g.unit or ''}); counted once"
            )
        else:
            kept.append(g)
    return kept


def date_text(iso: str) -> str:
    d = date.fromisoformat(iso)
    return f"{d.day} {calendar.month_name[d.month]} {d.year}"


def _combine(groups: list[FyGroup], notes: list[str]) -> dict[str, float] | None:
    """Adds groups across documents only when that can't mix organisations or series."""
    if len(groups) < 2:
        return None
    by_measure: dict[tuple, list[FyGroup]] = defaultdict(list)
    for g in groups:
        by_measure[(g.metric, unit_key(g.unit))].append(g)
    orgs = {(g.organisation or "").strip().lower() for g in groups}
    if "" in orgs or len(orgs) > 1:
        notes.append(
            "These documents belong to different organisations, or don't name one, so their "
            "figures are shown separately and not added together."
        )
        return None
    combined: dict[str, float] = {}
    for (metric, _unit), gs in by_measure.items():
        unit = gs[0].unit
        if len({g.document_id for g in gs}) != len(gs):
            notes.append(
                f"Some documents report {metric} ({unit}) in more than one way, so no combined "
                "total is shown."
            )
            continue
        combined[f"{metric} ({unit or 'no unit'})"] = round(sum(g.total for g in gs), 4)
    return combined or None
