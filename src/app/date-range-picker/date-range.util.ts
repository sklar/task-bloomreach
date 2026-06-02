/**
 * Pure, Temporal-only date-range logic (seam 1) — no Angular, no DOM.
 *
 * Every function is pure-in / pure-out: "today" is never read internally
 * (callers inject it via `presets.ts`), so behaviour is deterministically
 * testable. `Temporal` is a global type here; the runtime comes from native
 * Temporal in the browser and the Vitest shim under Node (JUSTIFICATION §12).
 */
import type { DateRange, PresetId } from './date-range.types';

/**
 * `en-GB` gives the design's day-first, no-leading-zero formatting (`9 Feb 2024`).
 * The exact month-name / weekday output depends on the host's full-ICU data —
 * present in the native browser and in Node's full-ICU build (test runtime); the
 * literal ` - ` / ` – ` separators are ours, not locale-derived.
 */
const LOCALE = 'en-GB';

const COMPACT_OPTS: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
};

const VERBOSE_OPTS: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
};

/** A single calendar cell in a month grid. */
export interface GridDay {
  date: Temporal.PlainDate;
  /** False for leading/trailing days that belong to the adjacent month. */
  inCurrentMonth: boolean;
}

/** Phase of the camp-B selection dance (JUSTIFICATION §4, §11). */
export type SelectionPhase = 'awaiting-end' | 'complete';

/** The pure slice of picker state the `nextSelection` reducer transforms. */
export interface SelectionState {
  draftStart: Temporal.PlainDate | null;
  draftEnd: Temporal.PlainDate | null;
  phase: SelectionPhase;
  activePreset: PresetId;
}

/**
 * The Sunday on or before `d`. ISO `dayOfWeek` is Mon=1…Sun=7, so `% 7` maps
 * Sunday (7) to 0 — a no-op — and every other day to its distance back to Sunday.
 */
export function weekStart(d: Temporal.PlainDate): Temporal.PlainDate {
  return d.subtract({ days: d.dayOfWeek % 7 });
}

/** Inclusive day count between two calendar dates (same day → 1). */
export function dayCount(start: Temporal.PlainDate, end: Temporal.PlainDate): number {
  return start.until(end).days + 1;
}

/** Compact trigger label (`10 Jan 2024 - 9 Feb 2024`); `Lifetime` when open-ended. */
export function formatCompact(range: DateRange): string {
  if (range.start === null) {
    return 'Lifetime';
  }
  return `${range.start.toLocaleString(LOCALE, COMPACT_OPTS)} - ${range.end.toLocaleString(
    LOCALE,
    COMPACT_OPTS,
  )}`;
}

/** Verbose footer summary (`Sunday, 1 October 2023 – Monday, 30 October 2023`). */
export function formatVerbose(range: DateRange): string {
  if (range.start === null) {
    return 'Lifetime';
  }
  return `${range.start.toLocaleString(LOCALE, VERBOSE_OPTS)} – ${range.end.toLocaleString(
    LOCALE,
    VERBOSE_OPTS,
  )}`;
}

/**
 * Sunday-first weeks covering `month`, padded with leading/trailing days from
 * the adjacent months so every week has 7 cells. Only as many weeks as the
 * month needs (4–6).
 */
export function buildMonthGrid(month: Temporal.PlainYearMonth): GridDay[][] {
  const firstOfMonth = month.toPlainDate({ day: 1 });
  const lastOfMonth = month.toPlainDate({ day: month.daysInMonth });

  const weeks: GridDay[][] = [];
  let cursor = weekStart(firstOfMonth);
  do {
    const week: GridDay[] = [];
    for (let i = 0; i < 7; i++) {
      week.push({ date: cursor, inCurrentMonth: cursor.toPlainYearMonth().equals(month) });
      cursor = cursor.add({ days: 1 });
    }
    weeks.push(week);
    // `cursor` now points at the next week's Sunday; keep going while month days remain.
  } while (Temporal.PlainDate.compare(cursor, lastOfMonth) <= 0);

  return weeks;
}

/** Earlier date first, so selection order never matters. */
function order(
  a: Temporal.PlainDate,
  b: Temporal.PlainDate,
): [Temporal.PlainDate, Temporal.PlainDate] {
  return Temporal.PlainDate.compare(a, b) <= 0 ? [a, b] : [b, a];
}

/**
 * Camp-B selection reducer (JUSTIFICATION §11): a click on a completed range (or
 * with no anchor yet) starts a fresh 1-day range; a click while awaiting the end
 * extends it, swapping if earlier than the anchor. Any manual click flips the
 * active preset to Custom range.
 */
export function nextSelection(state: SelectionState, clicked: Temporal.PlainDate): SelectionState {
  if (state.phase === 'complete' || state.draftStart === null) {
    return {
      draftStart: clicked,
      draftEnd: clicked,
      phase: 'awaiting-end',
      activePreset: 'custom',
    };
  }

  const [start, end] = order(state.draftStart, clicked);
  return { draftStart: start, draftEnd: end, phase: 'complete', activePreset: 'custom' };
}
