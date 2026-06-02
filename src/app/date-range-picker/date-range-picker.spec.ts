import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { DateRangePicker, TODAY } from './date-range-picker';
import type { DateRange } from './date-range.types';

const d = (s: string) => Temporal.PlainDate.from(s);

/**
 * Seam 2 — drive the public component only through inputs and DOM events
 * (PRD "Testing Decisions"). The fixture is attached to the document so focus
 * assertions are meaningful.
 *
 * jsdom has no Popover API, so these cover the component's own open/close layer.
 * The native `popover="auto"` path (top-layer render, light-dismiss, Esc,
 * focus-return) is identical observable behaviour but exercisable only in a real
 * browser — what I'd do with more time: a Playwright smoke test for it.
 */
function setup(
  inputs: { label?: string; value?: DateRange | null } = {},
): ComponentFixture<DateRangePicker> {
  const fixture = TestBed.createComponent(DateRangePicker);
  fixture.componentRef.setInput('label', inputs.label ?? 'Date range');
  if ('value' in inputs) {
    fixture.componentRef.setInput('value', inputs.value);
  }
  document.body.appendChild(fixture.nativeElement);
  fixture.detectChanges();
  return fixture;
}

const host = (f: ComponentFixture<DateRangePicker>) => f.nativeElement as HTMLElement;
const trigger = (f: ComponentFixture<DateRangePicker>) =>
  host(f).querySelector('button') as HTMLButtonElement;
const panel = (f: ComponentFixture<DateRangePicker>) =>
  host(f).querySelector('[role="dialog"]') as HTMLElement;

const pressEscape = (on: Element) =>
  on.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

describe('DateRangePicker (skeleton)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('open / close', () => {
    it('starts closed (aria-expanded is false)', () => {
      const f = setup();
      expect(trigger(f).getAttribute('aria-expanded')).toBe('false');
    });

    it('opens when the trigger is activated (aria-expanded flips to true)', () => {
      const f = setup();
      trigger(f).click();
      f.detectChanges();
      expect(trigger(f).getAttribute('aria-expanded')).toBe('true');
    });

    it('closes again on a second activation', () => {
      const f = setup();
      trigger(f).click();
      f.detectChanges();
      trigger(f).click();
      f.detectChanges();
      expect(trigger(f).getAttribute('aria-expanded')).toBe('false');
    });

    it('closes on Escape', () => {
      const f = setup();
      trigger(f).click();
      f.detectChanges();
      pressEscape(panel(f));
      f.detectChanges();
      expect(trigger(f).getAttribute('aria-expanded')).toBe('false');
    });

    it('closes on a click outside the picker (light-dismiss)', () => {
      const f = setup();
      trigger(f).click();
      f.detectChanges();
      document.body.click();
      f.detectChanges();
      expect(trigger(f).getAttribute('aria-expanded')).toBe('false');
    });

    it('stays open when clicking inside the panel', () => {
      const f = setup();
      trigger(f).click();
      f.detectChanges();
      panel(f).click();
      f.detectChanges();
      expect(trigger(f).getAttribute('aria-expanded')).toBe('true');
    });

    it('returns focus to the trigger on close', () => {
      const f = setup();
      trigger(f).focus();
      trigger(f).click();
      f.detectChanges();
      pressEscape(panel(f));
      f.detectChanges();
      expect(document.activeElement).toBe(trigger(f));
    });
  });

  describe('trigger label', () => {
    it('shows the mm/dd/yyyy placeholder when empty', () => {
      const f = setup({ value: null });
      expect(trigger(f).textContent?.trim()).toBe('mm/dd/yyyy');
    });

    it('shows the committed range in compact form', () => {
      const f = setup({ value: { start: d('2024-01-10'), end: d('2024-02-09') } });
      expect(trigger(f).textContent?.trim()).toBe('10 Jan 2024 - 9 Feb 2024');
    });
  });

  describe('ARIA wiring', () => {
    it('exposes aria-haspopup="dialog" and controls the panel', () => {
      const f = setup();
      const t = trigger(f);
      expect(t.getAttribute('aria-haspopup')).toBe('dialog');
      expect(t.getAttribute('aria-controls')).toBe(panel(f).id);
      expect(panel(f).id).toBeTruthy();
    });

    it('renders the panel as a dialog named by the visible label', () => {
      const f = setup({ label: 'Reporting period' });
      const p = panel(f);
      const labelEl = host(f).querySelector(`#${p.getAttribute('aria-labelledby')}`);
      expect(p.getAttribute('role')).toBe('dialog');
      expect(labelEl?.textContent?.trim()).toBe('Reporting period');
    });

    it('labels the trigger by the same visible label', () => {
      const f = setup({ label: 'Reporting period' });
      const labelEl = host(f).querySelector(`#${trigger(f).getAttribute('aria-labelledby')}`);
      expect(labelEl?.textContent?.trim()).toBe('Reporting period');
    });
  });

  describe('per-instance identity', () => {
    it('gives two instances on one page distinct ids and anchor names', () => {
      const a = setup();
      const b = setup();

      expect(trigger(a).getAttribute('aria-controls')).not.toBe(
        trigger(b).getAttribute('aria-controls'),
      );
      expect(panel(a).id).not.toBe(panel(b).id);

      const anchorA = trigger(a).style.getPropertyValue('anchor-name');
      const anchorB = trigger(b).style.getPropertyValue('anchor-name');
      expect(anchorA).toBeTruthy();
      expect(anchorA).not.toBe(anchorB);
      // The panel anchors to its own trigger, never a sibling's.
      expect(panel(a).style.getPropertyValue('position-anchor')).toBe(anchorA);
    });
  });

  /**
   * Seam 2 (slice 04) — the two-month calendar, driven through the root only
   * (the issue forbids unit-testing `MonthGrid` in isolation). `today` is pinned
   * via the `TODAY` token so the visible months and the today-marker are
   * deterministic. Days are addressed by their ISO `data-date`; the visual
   * states (`--start` / `--end` / `--in-range` / `--today`) are the queryable
   * surface, as the design encodes them.
   */
  describe('two-month calendar + day selection', () => {
    // 2024-02-15 is a Thursday; the chosen test days (10/15/20 Feb) live only in
    // the left month grid, so each ISO addresses exactly one cell.
    const FIXED_TODAY = '2024-02-15';

    function setupCal(
      opts: { today?: string; value?: DateRange | null } = {},
    ): ComponentFixture<DateRangePicker> {
      TestBed.configureTestingModule({
        providers: [{ provide: TODAY, useValue: d(opts.today ?? FIXED_TODAY) }],
      });
      const fixture = TestBed.createComponent(DateRangePicker);
      fixture.componentRef.setInput('label', 'Date range');
      if ('value' in opts) {
        fixture.componentRef.setInput('value', opts.value);
      }
      document.body.appendChild(fixture.nativeElement);
      fixture.detectChanges();
      return fixture;
    }

    const openCal = (f: ComponentFixture<DateRangePicker>) => {
      trigger(f).click();
      f.detectChanges();
    };
    const dayCell = (f: ComponentFixture<DateRangePicker>, iso: string) =>
      panel(f).querySelector(`.drp-day[data-date="${iso}"]`) as HTMLButtonElement | null;
    const clickDay = (f: ComponentFixture<DateRangePicker>, iso: string) => {
      dayCell(f, iso)!.click();
      f.detectChanges();
    };
    const hoverDay = (f: ComponentFixture<DateRangePicker>, iso: string) => {
      dayCell(f, iso)!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      f.detectChanges();
    };
    const monthEls = (f: ComponentFixture<DateRangePicker>) =>
      Array.from(panel(f).querySelectorAll('.drp-month')) as HTMLElement[];
    const captions = (f: ComponentFixture<DateRangePicker>) =>
      monthEls(f).map((m) => m.querySelector('.drp-month__caption')?.textContent?.trim());
    const inRangeCount = (f: ComponentFixture<DateRangePicker>) =>
      panel(f).querySelectorAll('.drp-day--in-range').length;

    describe('selection (camp B — always a valid range)', () => {
      it('makes the first click a 1-day range (start === end, nothing in between)', () => {
        const f = setupCal();
        openCal(f);

        clickDay(f, '2024-02-10');

        const cell = dayCell(f, '2024-02-10')!;
        expect(cell.classList.contains('drp-day--start')).toBe(true);
        expect(cell.classList.contains('drp-day--end')).toBe(true);
        expect(inRangeCount(f)).toBe(0);
      });

      it('extends the range when a later day is clicked second', () => {
        const f = setupCal();
        openCal(f);

        clickDay(f, '2024-02-10');
        clickDay(f, '2024-02-20');

        expect(dayCell(f, '2024-02-10')!.classList.contains('drp-day--start')).toBe(true);
        expect(dayCell(f, '2024-02-20')!.classList.contains('drp-day--end')).toBe(true);
        expect(dayCell(f, '2024-02-15')!.classList.contains('drp-day--in-range')).toBe(true);
      });

      it('swaps the endpoints when the second click is earlier than the first', () => {
        const f = setupCal();
        openCal(f);

        clickDay(f, '2024-02-15');
        clickDay(f, '2024-02-10');

        expect(dayCell(f, '2024-02-10')!.classList.contains('drp-day--start')).toBe(true);
        expect(dayCell(f, '2024-02-15')!.classList.contains('drp-day--end')).toBe(true);
      });
    });

    describe('hover preview', () => {
      it('previews the range-to-be while awaiting the second click', () => {
        const f = setupCal();
        openCal(f);

        clickDay(f, '2024-02-10');
        hoverDay(f, '2024-02-20');

        // Start/end vs in-between is distinguishable in the DOM during preview.
        expect(dayCell(f, '2024-02-10')!.classList.contains('drp-day--start')).toBe(true);
        expect(dayCell(f, '2024-02-20')!.classList.contains('drp-day--end')).toBe(true);
        expect(dayCell(f, '2024-02-15')!.classList.contains('drp-day--in-range')).toBe(true);
      });

      it('does not preview before the first click', () => {
        const f = setupCal();
        openCal(f);

        hoverDay(f, '2024-02-20');

        expect(inRangeCount(f)).toBe(0);
      });
    });

    describe('two-month window', () => {
      it('renders the view month and the next month side by side', () => {
        const f = setupCal();
        openCal(f);

        expect(monthEls(f).length).toBe(2);
        expect(captions(f)).toEqual(['February 2024', 'March 2024']);
      });

      it('marks today', () => {
        const f = setupCal();
        openCal(f);

        expect(dayCell(f, FIXED_TODAY)!.classList.contains('drp-day--today')).toBe(true);
      });

      it('shifts the window forward and back with the nav arrows', () => {
        const f = setupCal();
        openCal(f);

        (panel(f).querySelector('.drp__nav--next') as HTMLButtonElement).click();
        f.detectChanges();
        expect(captions(f)).toEqual(['March 2024', 'April 2024']);

        (panel(f).querySelector('.drp__nav--prev') as HTMLButtonElement).click();
        f.detectChanges();
        expect(captions(f)).toEqual(['February 2024', 'March 2024']);
      });
    });

    describe('active preset', () => {
      it('flips the active preset to "custom" on a manual day click', () => {
        const f = setupCal();
        openCal(f);

        // No named preset is active before any selection (presets land in slice 05).
        expect(f.componentInstance.activePreset()).toBeNull();

        clickDay(f, '2024-02-10');

        expect(f.componentInstance.activePreset()).toBe('custom');
      });
    });
  });
});

/**
 * Seam 2 (slice 05) — the Presets sidebar, driven through the root only (the
 * issue forbids unit-testing `PresetsList` in isolation). `today` is pinned via
 * the `TODAY` token so each preset's Range and the resulting month window are
 * deterministic. The radiogroup's accessible surface — `role`, `aria-checked`,
 * roving `tabindex`, the visible checkmark — is the queryable contract.
 */
describe('DateRangePicker — presets sidebar (slice 05)', () => {
  // 2024-02-15 is a Thursday; the days used below (1 Jan, 9/10/15/20 Feb) each
  // address exactly one cell across the two rendered months.
  const FIXED_TODAY = '2024-02-15';

  afterEach(() => {
    document.body.innerHTML = '';
  });

  function setupCal(
    opts: { today?: string; value?: DateRange | null } = {},
  ): ComponentFixture<DateRangePicker> {
    TestBed.configureTestingModule({
      providers: [{ provide: TODAY, useValue: d(opts.today ?? FIXED_TODAY) }],
    });
    const fixture = TestBed.createComponent(DateRangePicker);
    fixture.componentRef.setInput('label', 'Date range');
    if ('value' in opts) {
      fixture.componentRef.setInput('value', opts.value);
    }
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    return fixture;
  }

  const openCal = (f: ComponentFixture<DateRangePicker>) => {
    trigger(f).click();
    f.detectChanges();
  };
  const dayCell = (f: ComponentFixture<DateRangePicker>, iso: string) =>
    panel(f).querySelector(`.drp-day[data-date="${iso}"]`) as HTMLButtonElement | null;
  const clickDay = (f: ComponentFixture<DateRangePicker>, iso: string) => {
    dayCell(f, iso)!.click();
    f.detectChanges();
  };
  const captions = (f: ComponentFixture<DateRangePicker>) =>
    Array.from(panel(f).querySelectorAll('.drp-month__caption')).map((c) => c.textContent?.trim());
  const radiogroup = (f: ComponentFixture<DateRangePicker>) =>
    panel(f).querySelector('[role="radiogroup"]') as HTMLElement | null;
  const radios = (f: ComponentFixture<DateRangePicker>) =>
    Array.from(panel(f).querySelectorAll('[role="radio"]')) as HTMLElement[];
  const presetLabels = (f: ComponentFixture<DateRangePicker>) =>
    Array.from(panel(f).querySelectorAll('.drp-preset__label')).map((s) => s.textContent?.trim());
  const radioByLabel = (f: ComponentFixture<DateRangePicker>, label: string) =>
    radios(f).find((r) => r.textContent?.includes(label))!;
  const checkedRadios = (f: ComponentFixture<DateRangePicker>) =>
    radios(f).filter((r) => r.getAttribute('aria-checked') === 'true');
  const clickPreset = (f: ComponentFixture<DateRangePicker>, label: string) => {
    radioByLabel(f, label).click();
    f.detectChanges();
  };

  it('lists every preset in display order', () => {
    const f = setupCal();
    openCal(f);

    expect(presetLabels(f)).toEqual([
      'Lifetime',
      'Today',
      'Yesterday',
      'This week',
      'This month',
      'This year',
      'Last 7 days',
      'Last 14 days',
      'Last 30 days',
      'Last 90 days',
      'Custom range',
    ]);
  });

  it('is a radiogroup with a single tab stop', () => {
    const f = setupCal();
    openCal(f);

    expect(radiogroup(f)).not.toBeNull();
    expect(radios(f).filter((r) => r.getAttribute('tabindex') === '0')).toHaveLength(1);
  });

  it('selecting a preset fills the calendar selection and moves the month window', () => {
    const f = setupCal(); // today = 2024-02-15

    openCal(f);
    // Default window is today's month; "This year" starts in January, so the
    // window must move to show the chosen range.
    expect(captions(f)).toEqual(['February 2024', 'March 2024']);

    clickPreset(f, 'This year'); // 2024-01-01 .. 2024-02-15

    expect(captions(f)).toEqual(['January 2024', 'February 2024']);
    expect(dayCell(f, '2024-01-01')!.classList.contains('drp-day--start')).toBe(true);
    expect(dayCell(f, '2024-02-15')!.classList.contains('drp-day--end')).toBe(true);
  });

  it('marks the active preset checked with a visible checkmark; exactly one at a time', () => {
    const f = setupCal();
    openCal(f);

    clickPreset(f, 'Last 7 days');

    const active = radioByLabel(f, 'Last 7 days');
    expect(active.getAttribute('aria-checked')).toBe('true');
    expect(active.textContent).toContain('✓');
    expect(checkedRadios(f)).toHaveLength(1);
  });

  it('selecting Lifetime activates it and highlights no endpoints (open-ended)', () => {
    const f = setupCal();
    openCal(f);

    clickPreset(f, 'Lifetime');

    expect(radioByLabel(f, 'Lifetime').getAttribute('aria-checked')).toBe('true');
    expect(panel(f).querySelectorAll('.drp-day--start, .drp-day--end')).toHaveLength(0);
  });

  it('reflects a manual day selection as the Custom range preset', () => {
    const f = setupCal();
    openCal(f);

    clickDay(f, '2024-02-10');

    expect(radioByLabel(f, 'Custom range').getAttribute('aria-checked')).toBe('true');
    expect(checkedRadios(f)).toHaveLength(1);
  });

  it('treats clicking the already-active Custom range entry as a no-op', () => {
    const f = setupCal();
    openCal(f);

    clickDay(f, '2024-02-10');
    clickDay(f, '2024-02-20'); // custom range 10..20, complete

    clickPreset(f, 'Custom range');

    expect(dayCell(f, '2024-02-10')!.classList.contains('drp-day--start')).toBe(true);
    expect(dayCell(f, '2024-02-20')!.classList.contains('drp-day--end')).toBe(true);
    expect(radioByLabel(f, 'Custom range').getAttribute('aria-checked')).toBe('true');
  });
});

/**
 * Seam 2 (slice 06) — the Footer and the full commit/cancel lifecycle, driven
 * through the root only (the issue forbids unit-testing `Footer` in isolation).
 * `today` is pinned via `TODAY` so the draft, summary and day count are
 * deterministic. The Apply `console.log` is the assignment requirement; the
 * emitted value, the committed Trigger label and the open/closed state are the
 * queryable contract.
 */
describe('DateRangePicker — footer + apply/cancel (slice 06)', () => {
  // 2024-02-15 is a Thursday; every day used below addresses exactly one cell.
  const FIXED_TODAY = '2024-02-15';

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  function setupCal(
    opts: { today?: string; value?: DateRange | null } = {},
  ): ComponentFixture<DateRangePicker> {
    TestBed.configureTestingModule({
      providers: [{ provide: TODAY, useValue: d(opts.today ?? FIXED_TODAY) }],
    });
    const fixture = TestBed.createComponent(DateRangePicker);
    fixture.componentRef.setInput('label', 'Date range');
    if ('value' in opts) {
      fixture.componentRef.setInput('value', opts.value);
    }
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    return fixture;
  }

  const openCal = (f: ComponentFixture<DateRangePicker>) => {
    trigger(f).click();
    f.detectChanges();
  };
  const dayCell = (f: ComponentFixture<DateRangePicker>, iso: string) =>
    panel(f).querySelector(`.drp-day[data-date="${iso}"]`) as HTMLButtonElement | null;
  const clickDay = (f: ComponentFixture<DateRangePicker>, iso: string) => {
    dayCell(f, iso)!.click();
    f.detectChanges();
  };
  const clickPreset = (f: ComponentFixture<DateRangePicker>, label: string) => {
    const radio = Array.from(panel(f).querySelectorAll('[role="radio"]')).find((r) =>
      r.textContent?.includes(label),
    ) as HTMLElement;
    radio.click();
    f.detectChanges();
  };
  const footer = (f: ComponentFixture<DateRangePicker>) =>
    panel(f).querySelector('.drp-footer') as HTMLElement;
  const applyBtn = (f: ComponentFixture<DateRangePicker>) =>
    panel(f).querySelector('.drp-footer__apply') as HTMLButtonElement;
  const cancelBtn = (f: ComponentFixture<DateRangePicker>) =>
    panel(f).querySelector('.drp-footer__cancel') as HTMLButtonElement;
  const summaryEl = (f: ComponentFixture<DateRangePicker>) =>
    panel(f).querySelector('.drp-footer__range') as HTMLElement;
  const metaEl = (f: ComponentFixture<DateRangePicker>) =>
    panel(f).querySelector('.drp-footer__meta') as HTMLElement;

  describe('Apply commit cycle', () => {
    it('emits {start,end}, logs to console, commits to the Trigger, and closes', () => {
      const f = setupCal({ value: null });
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
      const emitted: DateRange[] = [];
      f.componentInstance.applied.subscribe((r) => emitted.push(r));

      openCal(f);
      clickDay(f, '2024-02-10');
      clickDay(f, '2024-02-20');
      applyBtn(f).click();
      f.detectChanges();

      expect(emitted).toHaveLength(1);
      expect(emitted[0].start?.toString()).toBe('2024-02-10');
      expect(emitted[0].end.toString()).toBe('2024-02-20');
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(emitted[0]);
      expect(trigger(f).textContent?.trim()).toBe('10 Feb 2024 - 20 Feb 2024');
      expect(trigger(f).getAttribute('aria-expanded')).toBe('false');
    });

    it('uncontrolled: updates the Trigger even when value is never echoed back', () => {
      const f = setupCal({ value: null });
      vi.spyOn(console, 'log').mockImplementation(() => undefined);

      openCal(f);
      clickDay(f, '2024-02-10');
      applyBtn(f).click();
      f.detectChanges();

      // Single-day range (camp B): Apply is enabled after the first click.
      expect(trigger(f).textContent?.trim()).toBe('10 Feb 2024 - 10 Feb 2024');
    });

    it('controlled: a consumer echoing the applied range keeps the Trigger in sync', () => {
      const f = setupCal({ value: null });
      vi.spyOn(console, 'log').mockImplementation(() => undefined);
      f.componentInstance.applied.subscribe((r) => f.componentRef.setInput('value', r));

      openCal(f);
      clickDay(f, '2024-02-10');
      clickDay(f, '2024-02-20');
      applyBtn(f).click();
      f.detectChanges();

      expect(trigger(f).textContent?.trim()).toBe('10 Feb 2024 - 20 Feb 2024');
    });

    it('round-trips a committed Lifetime range: reopening restores it', () => {
      const f = setupCal({ value: null });
      vi.spyOn(console, 'log').mockImplementation(() => undefined);

      openCal(f);
      clickPreset(f, 'Lifetime');
      applyBtn(f).click();
      f.detectChanges();

      // Reopen — the open-ended draft must come back, not an empty picker.
      openCal(f);
      expect(summaryEl(f).textContent?.trim()).toBe('Lifetime');
      expect(applyBtn(f).disabled).toBe(false);
      const lifetime = Array.from(panel(f).querySelectorAll('[role="radio"]')).find((r) =>
        r.textContent?.includes('Lifetime'),
      );
      expect(lifetime?.getAttribute('aria-checked')).toBe('true');
    });

    it('commits a Lifetime selection (open-ended) to the Trigger', () => {
      const f = setupCal({ value: null });
      vi.spyOn(console, 'log').mockImplementation(() => undefined);
      const emitted: DateRange[] = [];
      f.componentInstance.applied.subscribe((r) => emitted.push(r));

      openCal(f);
      clickPreset(f, 'Lifetime');
      applyBtn(f).click();
      f.detectChanges();

      expect(emitted[0].start).toBeNull();
      expect(trigger(f).textContent?.trim()).toBe('Lifetime');
    });
  });

  describe('Cancel / dismiss reverts to the committed range', () => {
    const committed = { start: '2024-02-05', end: '2024-02-08' };
    const compact = '5 Feb 2024 - 8 Feb 2024';

    const seeded = (): { value: DateRange } => ({
      value: { start: d(committed.start), end: d(committed.end) },
    });

    it('Cancel reverts the draft and closes', () => {
      const f = setupCal(seeded());
      openCal(f);
      clickDay(f, '2024-02-10');
      clickDay(f, '2024-02-20');

      cancelBtn(f).click();
      f.detectChanges();

      expect(trigger(f).textContent?.trim()).toBe(compact);
      expect(trigger(f).getAttribute('aria-expanded')).toBe('false');

      // Reopening shows the committed range, not the discarded draft.
      openCal(f);
      expect(dayCell(f, '2024-02-05')!.classList.contains('drp-day--start')).toBe(true);
      expect(dayCell(f, '2024-02-08')!.classList.contains('drp-day--end')).toBe(true);
      expect(dayCell(f, '2024-02-20')!.classList.contains('drp-day--end')).toBe(false);
    });

    it('Esc behaves identically to Cancel', () => {
      const f = setupCal(seeded());
      openCal(f);
      clickDay(f, '2024-02-20');

      pressEscape(panel(f));
      f.detectChanges();

      expect(trigger(f).textContent?.trim()).toBe(compact);
      expect(trigger(f).getAttribute('aria-expanded')).toBe('false');
      openCal(f);
      expect(dayCell(f, '2024-02-05')!.classList.contains('drp-day--start')).toBe(true);
    });

    it('click-outside behaves identically to Cancel', () => {
      const f = setupCal(seeded());
      openCal(f);
      clickDay(f, '2024-02-20');

      document.body.click();
      f.detectChanges();

      expect(trigger(f).textContent?.trim()).toBe(compact);
      expect(trigger(f).getAttribute('aria-expanded')).toBe('false');
    });
  });

  describe('canApply', () => {
    it('disables Apply until a range exists', () => {
      const f = setupCal({ value: null });
      openCal(f);

      expect(applyBtn(f).disabled).toBe(true);

      clickDay(f, '2024-02-10');
      expect(applyBtn(f).disabled).toBe(false);
    });

    it('enables Apply when Lifetime is active (open-ended)', () => {
      const f = setupCal({ value: null });
      openCal(f);

      clickPreset(f, 'Lifetime');
      expect(applyBtn(f).disabled).toBe(false);
    });
  });

  describe('Footer summary', () => {
    it('shows the verbose summary, inclusive day count, and Intl timezone', () => {
      const f = setupCal({ value: null });
      openCal(f);
      clickDay(f, '2024-02-10');
      clickDay(f, '2024-02-20');

      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const summary = summaryEl(f).textContent ?? '';
      expect(summary).toContain('Saturday');
      expect(summary).toContain('10 February 2024');
      expect(summary).toContain('Tuesday');
      expect(summary).toContain('20 February 2024');
      expect(summary).toContain('–');

      // 10 Feb → 20 Feb inclusive = 11 days.
      expect(metaEl(f).textContent).toContain('11 days');
      expect(metaEl(f).textContent).toContain(tz);
    });

    it('reads just "Lifetime" with no day count when Lifetime is active', () => {
      const f = setupCal({ value: null });
      openCal(f);

      clickPreset(f, 'Lifetime');

      expect(summaryEl(f).textContent?.trim()).toBe('Lifetime');
      expect(footer(f).textContent).not.toMatch(/day/i);
    });

    it('shows no meta line when nothing is selected', () => {
      const f = setupCal({ value: null });
      openCal(f);

      // An empty draft has no Range to qualify — no bare timezone under a blank summary.
      expect(summaryEl(f).textContent?.trim()).toBe('');
      expect(metaEl(f).textContent?.trim()).toBe('');
    });
  });

  describe('CVA touched semantics', () => {
    it('marks the control touched only after a real interaction', () => {
      const f = setupCal({ value: null });
      let touched = 0;
      f.componentInstance.registerOnTouched(() => {
        touched += 1;
      });

      // Open then dismiss with no change — not touched.
      openCal(f);
      pressEscape(panel(f));
      f.detectChanges();
      expect(touched).toBe(0);

      // Open, select a day, dismiss — now touched.
      openCal(f);
      clickDay(f, '2024-02-10');
      pressEscape(panel(f));
      f.detectChanges();
      expect(touched).toBe(1);
    });
  });
});
