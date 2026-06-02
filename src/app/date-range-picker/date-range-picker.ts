import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  InjectionToken,
  Renderer2,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import type { DateRange, PresetId } from './date-range.types';
import { type SelectionPhase, formatCompact, nextSelection } from './date-range.util';
import { MonthGrid } from './month-grid/month-grid';
import { PresetsList } from './presets-list/presets-list';
import { presetRange } from './presets';

/**
 * Today's calendar date, in the browser zone. A token (not a direct
 * `Temporal.Now` read) so specs can pin "today" and assert the two-month window
 * and the today-marker deterministically. Production gets the real value from
 * the root-provided factory.
 */
export const TODAY = new InjectionToken<Temporal.PlainDate>('drp.today', {
  providedIn: 'root',
  factory: () => Temporal.Now.plainDateISO(),
});

/**
 * Module-scoped instance counter → per-instance `uid` (JUSTIFICATION §7). Every
 * CSS anchor name and ARIA-wiring id derives from it, so multiple pickers on one
 * page never collide. No SSR here, so a plain counter is deterministic and safe.
 */
let nextId = 0;

/** Empty-state Trigger text — the design's placeholder (the button is never a typed input). */
const PLACEHOLDER = 'mm/dd/yyyy';

/**
 * The `DateRangePicker` root (seam 2). This slice is the walking skeleton: a
 * Trigger styled like an input that opens a native popover panel and wires the
 * open/collapse ARIA. The panel content (calendars, presets, footer) is filled
 * by later slices.
 *
 * **Open-state ownership.** `isOpen` is the single source of truth and drives
 * `aria-expanded`. Native `popover="auto"` + CSS Anchor Positioning give
 * top-layer rendering, light-dismiss, Esc and focus-return *for free in the
 * browser* (JUSTIFICATION §6) — but the Popover API is absent in jsdom and older
 * engines, so the close paths (Esc, click-outside, focus-return) are also driven
 * here. The two layers are idempotent: `close()` guards on `isOpen`, so a
 * native-initiated close (synced via `(toggle)`) and our own handler never fight.
 */
@Component({
  selector: 'app-date-range-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MonthGrid, PresetsList],
  template: `
    <span [id]="labelId" class="drp__label">{{ label() }}</span>

    <button
      #trigger
      type="button"
      class="drp__trigger"
      aria-haspopup="dialog"
      [attr.aria-labelledby]="labelId"
      [attr.aria-controls]="popoverId"
      [attr.aria-expanded]="isOpen()"
      [style.anchor-name]="anchorName"
      (click)="toggle()"
    >
      {{ triggerLabel() }}
    </button>

    <section
      #panel
      [id]="popoverId"
      popover="auto"
      role="dialog"
      [attr.aria-labelledby]="labelId"
      class="drp__panel"
      [style.position-anchor]="anchorName"
      (toggle)="onPopoverToggle($event)"
    >
      <div class="drp__body">
        <div class="drp__calendar">
          <button
            type="button"
            class="drp__nav drp__nav--prev"
            aria-label="Previous month"
            (click)="shiftWindow(-1)"
          >
            ‹
          </button>
          <button
            type="button"
            class="drp__nav drp__nav--next"
            aria-label="Next month"
            (click)="shiftWindow(1)"
          >
            ›
          </button>
          <app-month-grid
            [month]="viewMonth()"
            [range]="effectiveRange()"
            [today]="today"
            (daySelect)="onDaySelect($event)"
            (dayHover)="onDayHover($event)"
          />
          <app-month-grid
            [month]="viewMonthRight()"
            [range]="effectiveRange()"
            [today]="today"
            (daySelect)="onDaySelect($event)"
            (dayHover)="onDayHover($event)"
          />
        </div>
        <app-presets-list [activePreset]="activePreset()" (presetSelect)="onPresetSelect($event)" />
      </div>
      <!-- Footer filled by a later slice. -->
    </section>
  `,
  styleUrl: './date-range-picker.css',
  host: {
    class: 'drp',
    '(keydown)': 'onKeydown($event)',
  },
})
export class DateRangePicker {
  /** The committed Range the Trigger displays; `null` renders the placeholder. */
  readonly value = input<DateRange | null>(null);
  /** Required visible label — every design variant has one (JUSTIFICATION §3). */
  readonly label = input.required<string>();

  private readonly triggerRef = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly panelRef = viewChild.required<ElementRef<HTMLElement>>('panel');

  private readonly hostRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly renderer = inject(Renderer2);

  /** Today, in the browser zone — drives the default window and the today-marker. */
  protected readonly today = inject(TODAY);

  /** Per-instance identity (JUSTIFICATION §7). */
  protected readonly uid = `drp-${nextId++}`;
  protected readonly labelId = `${this.uid}-label`;
  protected readonly popoverId = `${this.uid}-popover`;
  /** Shared by the Trigger (`anchor-name`) and panel (`position-anchor`), bound inline. */
  protected readonly anchorName = `--${this.uid}-anchor`;

  /** Source of truth for open state; drives `aria-expanded` and panel visibility. */
  protected readonly isOpen = signal(false);

  /**
   * Mirrors the `value` input yet stays locally writable, so Apply can commit to
   * the Trigger even when the host doesn't echo `value` back (uncontrolled use —
   * JUSTIFICATION §4). Later slices write it on Apply; here it feeds the label.
   */
  protected readonly committed = linkedSignal(() => this.value());

  /** Compact summary of the committed Range, or the placeholder when empty. */
  protected readonly triggerLabel = computed(() => {
    const range = this.committed();
    return range ? formatCompact(range) : PLACEHOLDER;
  });

  // --- Calendar / draft selection state (JUSTIFICATION §4, §11) -------------

  /** In-progress selection endpoints; both null until the first day is clicked. */
  protected readonly draftStart = signal<Temporal.PlainDate | null>(null);
  protected readonly draftEnd = signal<Temporal.PlainDate | null>(null);
  /** Camp-B phase: `complete` (or no anchor) → next click starts fresh. */
  protected readonly selectionPhase = signal<SelectionPhase>('complete');
  /** The day under the pointer while awaiting the second click; drives the preview. */
  protected readonly hoveredDate = signal<Temporal.PlainDate | null>(null);
  /** Left calendar's month; the right calendar is this + 1 month. */
  protected readonly viewMonth = signal<Temporal.PlainYearMonth>(this.today.toPlainYearMonth());

  /**
   * The active Preset (sidebar lands in slice 05). `null` = no named preset
   * chosen yet; a manual day click flips it to `'custom'` via `nextSelection`.
   * Stored, not derived (JUSTIFICATION §4) — exposed read-only so the slice's
   * "manual click → custom" behaviour is assertable through the root.
   */
  private readonly activePresetState = signal<PresetId | null>(null);
  readonly activePreset = this.activePresetState.asReadonly();

  /** Right calendar's month. */
  protected readonly viewMonthRight = computed(() => this.viewMonth().add({ months: 1 }));

  /** True between the first and second clicks — when the preview band is live. */
  protected readonly selecting = computed(() => this.selectionPhase() === 'awaiting-end');

  /** Anchor ↔ hovered day while selecting, ordered; `null` when not previewing. */
  protected readonly previewRange = computed<DateRange | null>(() => {
    const anchor = this.draftStart();
    const hovered = this.hoveredDate();
    if (!this.selecting() || anchor === null || hovered === null) {
      return null;
    }
    return Temporal.PlainDate.compare(anchor, hovered) <= 0
      ? { start: anchor, end: hovered }
      : { start: hovered, end: anchor };
  });

  /** What the calendars highlight: the live preview, else the committed draft. */
  protected readonly effectiveRange = computed<DateRange | null>(() => {
    const preview = this.previewRange();
    if (preview !== null) {
      return preview;
    }
    const start = this.draftStart();
    const end = this.draftEnd();
    return start !== null && end !== null ? { start, end } : null;
  });

  constructor() {
    // Light-dismiss fallback for engines without the Popover API (jsdom, older
    // browsers). Native `popover="auto"` already does this where supported; the
    // two are idempotent (see class doc). Renderer2 keeps us off `@HostListener`.
    const unlisten = this.renderer.listen('document', 'click', (event: Event) =>
      this.onDocumentClick(event),
    );
    inject(DestroyRef).onDestroy(unlisten);
  }

  protected toggle(): void {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  private open(): void {
    if (this.isOpen()) {
      return;
    }
    this.seedDraft();
    this.isOpen.set(true);
    // Top-layer render in the browser; a no-op where the Popover API is absent.
    const panel = this.panelRef().nativeElement as HTMLElement & { showPopover?: () => void };
    try {
      panel.showPopover?.();
    } catch {
      /* already open / unsupported */
    }
  }

  /**
   * Seed the draft from the committed Range (open-time init in the toggle
   * handler, not an `effect` — JUSTIFICATION §4). A committed dated range opens
   * complete and focuses its month; empty (or Lifetime) opens with a clean draft
   * on today's window.
   */
  private seedDraft(): void {
    const committed = this.committed();
    this.hoveredDate.set(null);
    if (committed && committed.start) {
      this.draftStart.set(committed.start);
      this.draftEnd.set(committed.end);
      this.selectionPhase.set('complete');
      this.viewMonth.set(committed.start.toPlainYearMonth());
    } else {
      this.draftStart.set(null);
      this.draftEnd.set(null);
      this.selectionPhase.set('complete');
      this.viewMonth.set(this.today.toPlainYearMonth());
    }
  }

  /** A day click drives the camp-B reducer (fresh / extend / swap) and flips to Custom. */
  protected onDaySelect(clicked: Temporal.PlainDate): void {
    const next = nextSelection(
      {
        draftStart: this.draftStart(),
        draftEnd: this.draftEnd(),
        phase: this.selectionPhase(),
        activePreset: this.activePresetState() ?? 'custom',
      },
      clicked,
    );
    this.draftStart.set(next.draftStart);
    this.draftEnd.set(next.draftEnd);
    this.selectionPhase.set(next.phase);
    this.activePresetState.set(next.activePreset);
  }

  /**
   * Selecting a Preset fills the draft from the slice-02 mapping, stores it as
   * the active preset, and moves the two-month window so the chosen Range is
   * visible (its start month, or the end month for open-ended Lifetime).
   *
   * `presetRange` returns `null` only for `'custom'`, which has no mapping —
   * clicking it (active or not) is a no-op, since Custom range activates solely
   * via manual day selection (JUSTIFICATION §11).
   */
  protected onPresetSelect(id: PresetId): void {
    const range = presetRange(id, this.today);
    if (range === null) {
      return;
    }
    this.draftStart.set(range.start);
    this.draftEnd.set(range.end);
    this.selectionPhase.set('complete');
    this.hoveredDate.set(null);
    this.activePresetState.set(id);
    this.viewMonth.set((range.start ?? range.end).toPlainYearMonth());
  }

  /** Track the hovered day so the preview band can follow the pointer. */
  protected onDayHover(date: Temporal.PlainDate | null): void {
    this.hoveredDate.set(date);
  }

  /** Shift the two-month window by `delta` months (`‹` = -1, `›` = +1). */
  protected shiftWindow(delta: number): void {
    this.viewMonth.update((month) => month.add({ months: delta }));
  }

  private close(): void {
    if (!this.isOpen()) {
      return;
    }
    this.isOpen.set(false);
    const panel = this.panelRef().nativeElement as HTMLElement & { hidePopover?: () => void };
    try {
      panel.hidePopover?.();
    } catch {
      /* already closed / unsupported */
    }
    this.triggerRef().nativeElement.focus();
  }

  /** Sync state when the browser drives the popover itself (light-dismiss, Esc). */
  protected onPopoverToggle(event: Event): void {
    const open = (event as Event & { newState?: 'open' | 'closed' }).newState === 'open';
    if (open === this.isOpen()) {
      return;
    }
    this.isOpen.set(open);
    if (!open) {
      this.triggerRef().nativeElement.focus();
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.isOpen()) {
      event.preventDefault();
      this.close();
    }
  }

  private onDocumentClick(event: Event): void {
    // Redundant in browsers with native `popover="auto"` light-dismiss (which
    // already closed us, syncing via `(toggle)`); the `isOpen` guard makes the
    // duplicate a no-op. It earns its keep only where the Popover API is absent.
    if (!this.isOpen()) {
      return;
    }
    const target = event.target as Node | null;
    if (target && !this.hostRef.nativeElement.contains(target)) {
      this.close();
    }
  }
}
