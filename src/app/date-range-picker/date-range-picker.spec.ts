import { ComponentFixture, TestBed } from '@angular/core/testing';
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
