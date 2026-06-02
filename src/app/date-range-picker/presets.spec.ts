import { PRESETS, presetRange } from './presets';
import type { PresetId } from './date-range.types';

/** Deterministic "today" so preset mapping is pure-in / pure-out (issue: inject today). */
const THU = Temporal.PlainDate.from('2024-02-15'); // a Thursday (ISO dayOfWeek 4)
const SUN = Temporal.PlainDate.from('2024-02-11'); // a Sunday (ISO dayOfWeek 7)

const iso = (d: Temporal.PlainDate | null) => (d === null ? null : d.toString());

describe('preset catalogue', () => {
  it('lists every preset in sidebar order, ending with Custom range', () => {
    const ids = PRESETS.map((p) => p.id);

    expect(ids).toEqual<PresetId[]>([
      'lifetime',
      'today',
      'yesterday',
      'this-week',
      'this-month',
      'this-year',
      'last-7-days',
      'last-14-days',
      'last-30-days',
      'last-90-days',
      'custom',
    ]);
  });

  it('labels Custom range with the glossary term', () => {
    expect(PRESETS.find((p) => p.id === 'custom')?.label).toBe('Custom range');
  });
});

describe('presetRange — single-day presets', () => {
  it('Today is [T, T]', () => {
    const r = presetRange('today', THU)!;
    expect([iso(r.start), iso(r.end)]).toEqual(['2024-02-15', '2024-02-15']);
  });

  it('Yesterday is [T-1, T-1]', () => {
    const r = presetRange('yesterday', THU)!;
    expect([iso(r.start), iso(r.end)]).toEqual(['2024-02-14', '2024-02-14']);
  });
});

describe('presetRange — to-date presets (end = today)', () => {
  it('This week starts on Sunday and ends today', () => {
    const r = presetRange('this-week', THU)!;
    expect([iso(r.start), iso(r.end)]).toEqual(['2024-02-11', '2024-02-15']);
  });

  it('This week is a single day when today is Sunday', () => {
    const r = presetRange('this-week', SUN)!;
    expect([iso(r.start), iso(r.end)]).toEqual(['2024-02-11', '2024-02-11']);
  });

  it('This month starts on the 1st and ends today', () => {
    const r = presetRange('this-month', THU)!;
    expect([iso(r.start), iso(r.end)]).toEqual(['2024-02-01', '2024-02-15']);
  });

  it('This year starts on Jan 1 and ends today', () => {
    const r = presetRange('this-year', THU)!;
    expect([iso(r.start), iso(r.end)]).toEqual(['2024-01-01', '2024-02-15']);
  });
});

describe('presetRange — Last N days include today', () => {
  it.each([
    ['last-7-days', '2024-02-09'],
    ['last-14-days', '2024-02-02'],
    ['last-30-days', '2024-01-17'],
    ['last-90-days', '2023-11-18'],
  ] as const)('%s is [T-(N-1), T]', (id, start) => {
    const r = presetRange(id, THU)!;
    expect([iso(r.start), iso(r.end)]).toEqual([start, '2024-02-15']);
  });
});

describe('presetRange — Lifetime and Custom', () => {
  it('Lifetime has a null start and ends today', () => {
    const r = presetRange('lifetime', THU)!;
    expect(r.start).toBeNull();
    expect(iso(r.end)).toBe('2024-02-15');
  });

  it('Custom maps to no range (manual selection only)', () => {
    expect(presetRange('custom', THU)).toBeNull();
  });
});
