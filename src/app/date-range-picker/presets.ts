/**
 * The preset catalogue and the preset → Range mapping (JUSTIFICATION §5).
 *
 * `today` is always an injected parameter — `Temporal.Now` is never read here —
 * so the mapping is deterministically testable (issue 02 acceptance criteria).
 */
import type { DateRange, PresetId } from './date-range.types';
import { weekStart } from './date-range.util';

/** A named shortcut shown in the sidebar. */
export interface Preset {
  id: PresetId;
  label: string;
}

/** The sidebar catalogue, in display order (PRD). Custom range is last. */
export const PRESETS: readonly Preset[] = [
  { id: 'lifetime', label: 'Lifetime' },
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'this-week', label: 'This week' },
  { id: 'this-month', label: 'This month' },
  { id: 'this-year', label: 'This year' },
  { id: 'last-7-days', label: 'Last 7 days' },
  { id: 'last-14-days', label: 'Last 14 days' },
  { id: 'last-30-days', label: 'Last 30 days' },
  { id: 'last-90-days', label: 'Last 90 days' },
  { id: 'custom', label: 'Custom range' },
];

/**
 * The Range a preset maps to, given `today`. Last-N ranges include today;
 * This week/month/year are to-date (end = today); Lifetime is open-ended
 * (`null` start). `custom` has no mapping — it only activates via manual
 * selection — so it returns `null`.
 */
export function presetRange(id: PresetId, today: Temporal.PlainDate): DateRange | null {
  switch (id) {
    case 'today':
      return { start: today, end: today };
    case 'yesterday': {
      const yesterday = today.subtract({ days: 1 });
      return { start: yesterday, end: yesterday };
    }
    case 'this-week':
      return { start: weekStart(today), end: today };
    case 'this-month':
      return { start: today.with({ day: 1 }), end: today };
    case 'this-year':
      return { start: today.with({ month: 1, day: 1 }), end: today };
    case 'last-7-days':
      return { start: today.subtract({ days: 6 }), end: today };
    case 'last-14-days':
      return { start: today.subtract({ days: 13 }), end: today };
    case 'last-30-days':
      return { start: today.subtract({ days: 29 }), end: today };
    case 'last-90-days':
      return { start: today.subtract({ days: 89 }), end: today };
    case 'lifetime':
      return { start: null, end: today };
    case 'custom':
      return null;
  }
}
