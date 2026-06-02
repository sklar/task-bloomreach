import {
  weekStart,
  dayCount,
  formatCompact,
  formatVerbose,
  buildMonthGrid,
  nextSelection,
  type SelectionState,
} from './date-range.util';
import type { DateRange } from './date-range.types';

const d = (s: string) => Temporal.PlainDate.from(s);

describe('weekStart', () => {
  it('snaps to the Sunday on or before a mid-week day', () => {
    expect(weekStart(d('2024-02-15')).toString()).toBe('2024-02-11'); // Thu -> Sun
  });

  it('is a no-op when the day is already Sunday', () => {
    expect(weekStart(d('2024-02-11')).toString()).toBe('2024-02-11');
  });
});

describe('dayCount (inclusive)', () => {
  it('counts a single day as 1', () => {
    expect(dayCount(d('2024-01-10'), d('2024-01-10'))).toBe(1);
  });

  it('counts 10 Jan -> 9 Feb as 31 (per the glossary)', () => {
    expect(dayCount(d('2024-01-10'), d('2024-02-09'))).toBe(31);
  });

  it('counts inclusively across a multi-month span (10 Jan -> 9 Mar = 60)', () => {
    // Guards against `until()` regressing to month-granularity, which a
    // sub-month span would not catch.
    expect(dayCount(d('2024-01-10'), d('2024-03-09'))).toBe(60);
  });
});

describe('formatCompact', () => {
  it('renders the PRD example string', () => {
    const range: DateRange = { start: d('2024-01-10'), end: d('2024-02-09') };
    expect(formatCompact(range)).toBe('10 Jan 2024 - 9 Feb 2024');
  });

  it('renders Lifetime when the start is open-ended', () => {
    expect(formatCompact({ start: null, end: d('2024-02-09') })).toBe('Lifetime');
  });
});

describe('formatVerbose', () => {
  it('renders the PRD example string with weekday and en-dash separator', () => {
    const range: DateRange = { start: d('2023-10-01'), end: d('2023-10-30') };
    expect(formatVerbose(range)).toBe('Sunday, 1 October 2023 – Monday, 30 October 2023');
  });

  it('renders just "Lifetime" when the start is open-ended', () => {
    expect(formatVerbose({ start: null, end: d('2023-10-30') })).toBe('Lifetime');
  });
});

describe('buildMonthGrid', () => {
  it('produces full Sunday-first weeks covering the month (Feb 2024)', () => {
    const weeks = buildMonthGrid(Temporal.PlainYearMonth.from('2024-02'));
    const flat = weeks.flat();

    // Feb 2024 starts Thursday -> 4 leading days, 29 in-month, 2 trailing = 5 weeks.
    expect(weeks).toHaveLength(5);
    expect(flat).toHaveLength(35);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    // Every week begins on a Sunday (ISO dayOfWeek 7).
    expect(weeks.every((w) => w[0].date.dayOfWeek === 7)).toBe(true);
  });

  it('marks leading/trailing days as outside the current month (Feb 2024)', () => {
    const flat = buildMonthGrid(Temporal.PlainYearMonth.from('2024-02')).flat();

    expect(flat[0].date.toString()).toBe('2024-01-28'); // leading Sunday
    expect(flat[0].inCurrentMonth).toBe(false);
    expect(flat[34].date.toString()).toBe('2024-03-02'); // trailing Saturday
    expect(flat[34].inCurrentMonth).toBe(false);
    expect(flat.filter((c) => c.inCurrentMonth)).toHaveLength(29);
  });

  it('has no leading days when the month starts on a Sunday (Sep 2024)', () => {
    const weeks = buildMonthGrid(Temporal.PlainYearMonth.from('2024-09'));
    const first = weeks[0][0];

    expect(first.date.toString()).toBe('2024-09-01');
    expect(first.inCurrentMonth).toBe(true);
  });
});

describe('nextSelection reducer (camp B — always a valid range)', () => {
  const fresh: SelectionState = {
    draftStart: null,
    draftEnd: null,
    phase: 'complete',
    activePreset: 'this-month',
  };

  it('starts a fresh 1-day range on the first click', () => {
    const next = nextSelection(fresh, d('2024-02-10'));

    expect(next.draftStart?.toString()).toBe('2024-02-10');
    expect(next.draftEnd?.toString()).toBe('2024-02-10');
    expect(next.phase).toBe('awaiting-end');
  });

  it('extends the range to a later second click', () => {
    const anchored = nextSelection(fresh, d('2024-02-10'));
    const next = nextSelection(anchored, d('2024-02-20'));

    expect(next.draftStart?.toString()).toBe('2024-02-10');
    expect(next.draftEnd?.toString()).toBe('2024-02-20');
    expect(next.phase).toBe('complete');
  });

  it('swaps when the second click is earlier than the anchor', () => {
    const anchored = nextSelection(fresh, d('2024-02-10'));
    const next = nextSelection(anchored, d('2024-02-05'));

    expect(next.draftStart?.toString()).toBe('2024-02-05');
    expect(next.draftEnd?.toString()).toBe('2024-02-10');
    expect(next.phase).toBe('complete');
  });

  it('restarts a fresh range when clicking on a completed selection', () => {
    const complete: SelectionState = {
      draftStart: d('2024-02-10'),
      draftEnd: d('2024-02-20'),
      phase: 'complete',
      activePreset: 'custom',
    };
    const next = nextSelection(complete, d('2024-03-01'));

    expect(next.draftStart?.toString()).toBe('2024-03-01');
    expect(next.draftEnd?.toString()).toBe('2024-03-01');
    expect(next.phase).toBe('awaiting-end');
  });

  it('flips the active preset to Custom range on any manual click', () => {
    expect(nextSelection(fresh, d('2024-02-10')).activePreset).toBe('custom');

    const anchored = nextSelection(fresh, d('2024-02-10'));
    expect(nextSelection(anchored, d('2024-02-20')).activePreset).toBe('custom');
  });
});
