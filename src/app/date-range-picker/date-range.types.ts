/**
 * Shared types for the date-range picker — the locked public contract (PRD).
 *
 * `Temporal.PlainDate` is the model: a calendar date with no time-of-day and no
 * timezone, which is exactly a Range endpoint (ADR-0001 / JUSTIFICATION §1–§2).
 * `Temporal` is a global type only here — there is no runtime import in app code
 * (JUSTIFICATION §12); see `src/global.d.ts`.
 */

/** A named shortcut that maps to a Range; `custom` is active for manual selection. */
export type PresetId =
  | 'lifetime'
  | 'today'
  | 'yesterday'
  | 'this-week'
  | 'this-month'
  | 'this-year'
  | 'last-7-days'
  | 'last-14-days'
  | 'last-30-days'
  | 'last-90-days'
  | 'custom';

/** A pair of inclusive calendar dates. `start` is null only for Lifetime (open-ended). */
export interface DateRange {
  start: Temporal.PlainDate | null;
  end: Temporal.PlainDate;
}
