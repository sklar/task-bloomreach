import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DateRangePicker } from './date-range-picker';
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
});
