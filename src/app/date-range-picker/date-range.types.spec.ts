import type { DateRange, PresetId } from './date-range.types';

describe('Temporal test shim', () => {
  it('constructs a Temporal.PlainDate and exposes its calendar fields', () => {
    const d = Temporal.PlainDate.from('2024-01-10');

    expect(d.year).toBe(2024);
    expect(d.month).toBe(1);
    expect(d.day).toBe(10);
  });

  it('does inclusive calendar-date arithmetic (10 Jan -> 9 Feb = 31 days)', () => {
    const start = Temporal.PlainDate.from('2024-01-10');
    const end = Temporal.PlainDate.from('2024-02-09');

    // Inclusive day count per the glossary: span length + 1.
    expect(start.until(end).days + 1).toBe(31);
  });
});

describe('shared date-range types compose with Temporal', () => {
  it('models a concrete Range as two PlainDate endpoints', () => {
    const range: DateRange = {
      start: Temporal.PlainDate.from('2024-01-10'),
      end: Temporal.PlainDate.from('2024-02-09'),
    };

    expect(range.start?.toString()).toBe('2024-01-10');
    expect(range.end.toString()).toBe('2024-02-09');
  });

  it('models Lifetime as a null start with a concrete end', () => {
    const lifetime: DateRange = {
      start: null,
      end: Temporal.PlainDate.from('2024-02-09'),
    };

    expect(lifetime.start).toBeNull();
    expect(lifetime.end.toString()).toBe('2024-02-09');
  });

  it('uses the PresetId vocabulary', () => {
    const ids: PresetId[] = ['lifetime', 'today', 'custom'];

    expect(ids).toContain('custom');
  });
});
