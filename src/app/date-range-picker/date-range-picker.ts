import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  InjectionToken,
  Injector,
  Renderer2,
  afterNextRender,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { type ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import type { DateRange, PresetId } from './date-range.types';
import {
  type SelectionPhase,
  type SelectionState,
  dayCount,
  formatCompact,
  formatVerbose,
  nextSelection,
  weekStart,
} from './date-range.util';
import { Footer } from './footer/footer';
import { MonthGrid } from './month-grid/month-grid';
import { PresetsList } from './presets-list/presets-list';
import { PRESETS, presetRange } from './presets';

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
  selector: 'bloom-date-range-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MonthGrid, PresetsList, Footer],
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
        <!-- Keyboard nav is owned by the root (JUSTIFICATION §8/§9): the grids are
             presentational, so Arrow/Home/End/PageUp/PageDown/Enter/Space are
             handled on the host keydown (delegated off the focused gridcell) and
             keyed off the focused-day signal. -->
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
          <bloom-drp-month-grid
            [month]="viewMonth()"
            [range]="effectiveRange()"
            [today]="today"
            [focused]="gridFocusDate()"
            (daySelect)="onDaySelect($event)"
            (dayHover)="onDayHover($event)"
          />
          <bloom-drp-month-grid
            [month]="viewMonthRight()"
            [range]="effectiveRange()"
            [today]="today"
            [focused]="gridFocusDate()"
            (daySelect)="onDaySelect($event)"
            (dayHover)="onDayHover($event)"
          />
        </div>
        <bloom-drp-presets-list
          [activePreset]="activePreset()"
          (presetSelect)="onPresetSelect($event)"
        />
      </div>
      <bloom-drp-footer
        [summary]="summaryText()"
        [dayCount]="draftDayCount()"
        [canApply]="canApply()"
        (apply)="apply()"
        (dismiss)="cancel()"
      />
    </section>

    <!-- Visually-hidden polite live region (JUSTIFICATION §8): announces only the
         discrete events — selection started, range completed (with day count),
         preset applied, month window changed — never hover, to avoid spam. -->
    <div class="drp__sr-only" role="status" aria-live="polite">{{ liveMessage() }}</div>
  `,
  styleUrl: './date-range-picker.css',
  host: {
    class: 'drp',
    '(keydown)': 'onKeydown($event)',
  },
  providers: [
    {
      // CVA is the intended Angular form-integration path (JUSTIFICATION §7):
      // `<picker formControlName="…">` / `[(ngModel)]` drive the same `committed`
      // signal the `value` input does, so the component works in a form, controlled,
      // and uncontrolled. Native `<form>`/hidden-input participation stays out of scope.
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DateRangePicker),
      multi: true,
    },
  ],
})
export class DateRangePicker implements ControlValueAccessor {
  /** The committed Range the Trigger displays; `null` renders the placeholder. */
  readonly value = input<DateRange | null>(null);
  /** Required visible label — every design variant has one (JUSTIFICATION §3). */
  readonly label = input.required<string>();

  /** Emits the committed Range on Apply (`{ start, end }`); the sole output (JUSTIFICATION §3). */
  readonly applied = output<DateRange>();

  private readonly triggerRef = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly panelRef = viewChild.required<ElementRef<HTMLElement>>('panel');

  private readonly hostRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly renderer = inject(Renderer2);
  /** For scheduling post-render focus moves from outside the constructor. */
  private readonly injector = inject(Injector);

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
   * The keyboard-focused day (roving tabindex + the Enter/Space select target).
   * Set on open (selected day, else today), on day click, and on each arrow move.
   */
  protected readonly focusedDate = signal<Temporal.PlainDate>(this.today);

  /** Visually-hidden polite live-region text; set only on discrete events (§8). */
  protected readonly liveMessage = signal('');

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

  /**
   * The day both grids receive as their roving-tabindex target. Normally the
   * focused day, but if it scrolled out of the visible window (e.g. a mouse-driven
   * nav-arrow shift), it falls back to the 1st of the left month so a tabbable
   * cell always exists. Keyboard moves keep the focused day visible, so there it
   * equals `focusedDate`.
   */
  protected readonly gridFocusDate = computed<Temporal.PlainDate>(() => {
    const focused = this.focusedDate();
    const left = this.viewMonth();
    const month = focused.toPlainYearMonth();
    const inWindow =
      Temporal.PlainYearMonth.compare(month, left) >= 0 &&
      Temporal.PlainYearMonth.compare(month, left.add({ months: 1 })) <= 0;
    return inWindow ? focused : left.toPlainDate({ day: 1 });
  });

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

  // --- Footer / commit lifecycle (slice 06) ---------------------------------

  /**
   * The Range the footer summarises and Apply would commit. `null` when nothing
   * is selected; `{ start: null, end }` for Lifetime (open-ended). The encoding
   * is read straight off the draft: an empty draft leaves `draftEnd` null, while
   * Lifetime seeds `draftStart = null` with a dated `draftEnd` (JUSTIFICATION §5).
   */
  protected readonly draftRange = computed<DateRange | null>(() => {
    const end = this.draftEnd();
    if (end === null) {
      return null;
    }
    return { start: this.draftStart(), end };
  });

  /** Verbose footer summary of the draft (`Sunday, … – …`), or "Lifetime"; empty when none. */
  protected readonly summaryText = computed(() => {
    const range = this.draftRange();
    return range ? formatVerbose(range) : '';
  });

  /** Inclusive day count of the draft; `null` for Lifetime or an empty draft (no count shown). */
  protected readonly draftDayCount = computed<number | null>(() => {
    const range = this.draftRange();
    if (range === null || range.start === null) {
      return null;
    }
    return dayCount(range.start, range.end);
  });

  /** Apply is enabled whenever a Range exists or Lifetime is active (JUSTIFICATION §11). */
  protected readonly canApply = computed(() => this.draftRange() !== null);

  /**
   * The most recently applied Range, bumped on each Apply so the `console.log`
   * side-effect can live in an `effect` rather than the click handler or computed
   * state (issue 06; JUSTIFICATION §4).
   */
  private readonly appliedLog = signal<DateRange | null>(null);

  /**
   * Whether the user has engaged the draft this open session (selected a day or
   * preset, or applied). Gates the CVA `onTouched` so merely opening and
   * dismissing — open-then-Esc with no change — does not mark the control
   * touched. Plain field: it drives no view, only the touched side-effect.
   */
  private interacted = false;

  constructor() {
    // Light-dismiss fallback for engines without the Popover API (jsdom, older
    // browsers). Native `popover="auto"` already does this where supported; the
    // two are idempotent (see class doc). Renderer2 keeps us off `@HostListener`.
    const unlisten = this.renderer.listen('document', 'click', (event: Event) =>
      this.onDocumentClick(event),
    );
    inject(DestroyRef).onDestroy(unlisten);

    // Side-effect, not computed state (issue 06; JUSTIFICATION §4): surface every
    // applied Range to the console (assignment requirement). Each Apply sets a
    // fresh `appliedLog` object, so re-applying the same dates still logs.
    effect(() => {
      const range = this.appliedLog();
      if (range !== null) {
        console.log(range);
      }
    });
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
    // Focus moves into the calendar on open — the selected day, else today (§8).
    this.focusFocusedDay();
  }

  /**
   * Move DOM focus to the focused day's gridcell after the next render (the
   * target month may need to paint first — e.g. after a window shift). The
   * roving-tabindex cell carries `tabindex="0"`, so it is the unique target
   * across the two grids.
   */
  private focusFocusedDay(): void {
    afterNextRender(
      () => {
        const cell =
          this.panelRef().nativeElement.querySelector<HTMLElement>('.drp-day[tabindex="0"]');
        cell?.focus();
      },
      { injector: this.injector },
    );
  }

  /**
   * Seed the draft from the committed Range (open-time init in the toggle
   * handler, not an `effect` — JUSTIFICATION §4).
   *
   * Three cases:
   * - **Dated range** → restore it, focus its start month. The preset that
   *   produced it isn't persisted (§3), so no named preset is active.
   * - **Lifetime** (committed but open-ended, `start === null`) → restore the
   *   open-ended draft and re-activate the Lifetime preset, so the footer reads
   *   "Lifetime", Apply stays enabled, and the sidebar highlights it on reopen.
   * - **Empty** → a clean draft on today's window.
   */
  private seedDraft(): void {
    const committed = this.committed();
    this.hoveredDate.set(null);
    this.selectionPhase.set('complete');
    if (committed && committed.start) {
      this.draftStart.set(committed.start);
      this.draftEnd.set(committed.end);
      this.activePresetState.set(null);
      this.viewMonth.set(committed.start.toPlainYearMonth());
      this.focusedDate.set(committed.start);
    } else if (committed) {
      this.draftStart.set(null);
      this.draftEnd.set(committed.end);
      this.activePresetState.set('lifetime');
      this.viewMonth.set(committed.end.toPlainYearMonth());
      this.focusedDate.set(committed.end);
    } else {
      this.draftStart.set(null);
      this.draftEnd.set(null);
      this.activePresetState.set(null);
      this.viewMonth.set(this.today.toPlainYearMonth());
      this.focusedDate.set(this.today);
    }
  }

  /** A day click drives the camp-B reducer (fresh / extend / swap) and flips to Custom. */
  protected onDaySelect(clicked: Temporal.PlainDate): void {
    this.interacted = true;
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
    // Roving tabindex follows the selection (mouse or keyboard).
    this.focusedDate.set(clicked);
    this.announceSelection(next);
  }

  /**
   * Announce the discrete selection event (§8): a fresh anchor reads as a started
   * selection; a completed range reads with its inclusive day count.
   */
  private announceSelection(next: SelectionState): void {
    if (next.draftStart === null) {
      return;
    }
    if (next.phase === 'awaiting-end') {
      this.liveMessage.set(
        `Start date ${this.formatA11y(next.draftStart)} selected. Pick an end date.`,
      );
      return;
    }
    const count = dayCount(next.draftStart, next.draftEnd!);
    this.liveMessage.set(
      `Range selected: ${this.formatA11y(next.draftStart)} to ${this.formatA11y(next.draftEnd!)}, ${count} ${count === 1 ? 'day' : 'days'}.`,
    );
  }

  /** A full date without a weekday, for live-region announcements (`10 February 2024`). */
  private formatA11y(date: Temporal.PlainDate): string {
    return date.toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
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
    this.interacted = true;
    this.draftStart.set(range.start);
    this.draftEnd.set(range.end);
    this.selectionPhase.set('complete');
    this.hoveredDate.set(null);
    this.activePresetState.set(id);
    const anchor = range.start ?? range.end;
    this.viewMonth.set(anchor.toPlainYearMonth());
    this.focusedDate.set(anchor);
    this.announcePreset(id, range);
  }

  /** Announce an applied preset (§8): the label, plus the range it set (no count for Lifetime). */
  private announcePreset(id: PresetId, range: DateRange): void {
    const label = PRESETS.find((preset) => preset.id === id)?.label ?? id;
    if (range.start === null) {
      this.liveMessage.set(`${label} preset applied.`);
      return;
    }
    const count = dayCount(range.start, range.end);
    this.liveMessage.set(
      `${label} preset applied: ${formatVerbose(range)}, ${count} ${count === 1 ? 'day' : 'days'}.`,
    );
  }

  /** Track the hovered day so the preview band can follow the pointer. */
  protected onDayHover(date: Temporal.PlainDate | null): void {
    this.hoveredDate.set(date);
  }

  /** Shift the two-month window by `delta` months (`‹` = -1, `›` = +1). */
  protected shiftWindow(delta: number): void {
    this.viewMonth.update((month) => month.add({ months: delta }));
    this.announceWindow();
  }

  /** Announce the visible two-month window (§8: "month window changed"). */
  private announceWindow(): void {
    const fmt = (ym: Temporal.PlainYearMonth) =>
      ym.toPlainDate({ day: 1 }).toLocaleString('en-GB', { month: 'long', year: 'numeric' });
    this.liveMessage.set(`Showing ${fmt(this.viewMonth())} and ${fmt(this.viewMonthRight())}.`);
  }

  /**
   * Promote the draft to the Committed range: commit it locally (so the Trigger
   * updates even uncontrolled), notify any form (CVA), emit `applied`, queue the
   * `console.log` side-effect, and close. Guarded by `canApply` — a no-op when no
   * Range exists.
   */
  protected apply(): void {
    const range = this.draftRange();
    if (range === null) {
      return;
    }
    this.interacted = true;
    const committed: DateRange = { start: range.start, end: range.end };
    this.committed.set(committed);
    this.onChange(committed);
    this.applied.emit(committed);
    this.appliedLog.set(committed);
    this.close();
  }

  /**
   * Discard the draft and close. The committed Range is untouched, so the Trigger
   * keeps its previous value and reopening re-seeds the draft from it (`seedDraft`)
   * — the revert. Esc and click-outside route here, so dismissal is uniform.
   */
  protected cancel(): void {
    this.close();
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
    // Mark touched only on a real dismiss-after-interaction (blur semantics):
    // opening and immediately dismissing leaves the control untouched.
    if (this.interacted) {
      this.onTouched();
      this.interacted = false;
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
      // Esc behaves like Cancel (PRD user story 38).
      this.cancel();
      return;
    }
    // Delegated grid navigation: only when a day cell holds focus, so the nav
    // arrows (‹ ›) and presets keep their own key handling.
    const target = event.target as HTMLElement | null;
    if (target?.classList.contains('drp-day')) {
      this.onCalendarKeydown(event);
    }
  }

  /**
   * Grid keyboard model (JUSTIFICATION §8 D). ←→ day, ↑↓ week, Home/End week edges,
   * PageUp/PageDown month, Enter/Space select. Moving off a visible edge shifts the
   * two-month window (`moveFocus` → `ensureVisible`). Out of scope (left as a
   * comment per the issue): Shift+PageUp/Down year jump and other exotic APG keys.
   */
  private onCalendarKeydown(event: KeyboardEvent): void {
    const focused = this.focusedDate();
    switch (event.key) {
      case 'ArrowLeft':
        this.moveFocus(focused.subtract({ days: 1 }));
        break;
      case 'ArrowRight':
        this.moveFocus(focused.add({ days: 1 }));
        break;
      case 'ArrowUp':
        this.moveFocus(focused.subtract({ days: 7 }));
        break;
      case 'ArrowDown':
        this.moveFocus(focused.add({ days: 7 }));
        break;
      case 'Home':
        this.moveFocus(weekStart(focused));
        break;
      case 'End':
        this.moveFocus(weekStart(focused).add({ days: 6 }));
        break;
      case 'PageUp':
        this.moveFocus(focused.subtract({ months: 1 }));
        break;
      case 'PageDown':
        this.moveFocus(focused.add({ months: 1 }));
        break;
      case 'Enter':
      case ' ':
        this.onDaySelect(focused);
        break;
      default:
        return; // Unhandled key — let it through (no preventDefault).
    }
    event.preventDefault();
  }

  /**
   * Move keyboard focus to `next`, shifting the two-month window if `next` fell
   * off a visible edge (announcing the shift), then move DOM focus once the target
   * month has rendered.
   */
  private moveFocus(next: Temporal.PlainDate): void {
    const before = this.viewMonth();
    this.focusedDate.set(next);
    this.ensureVisible(next);
    if (!before.equals(this.viewMonth())) {
      this.announceWindow();
    }
    this.focusFocusedDay();
  }

  /** Keep `date` within the two-month window, shifting by the minimum if it is outside. */
  private ensureVisible(date: Temporal.PlainDate): void {
    const month = date.toPlainYearMonth();
    const left = this.viewMonth();
    if (Temporal.PlainYearMonth.compare(month, left) < 0) {
      this.viewMonth.set(month);
    } else if (Temporal.PlainYearMonth.compare(month, left.add({ months: 1 })) > 0) {
      this.viewMonth.set(month.subtract({ months: 1 }));
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
      // Click-outside behaves like Cancel (PRD user story 37).
      this.cancel();
    }
  }

  // --- ControlValueAccessor (JUSTIFICATION §7) ------------------------------
  // Form integration drives the same locally-writable `committed` signal as the
  // `value` input, so `formControlName` / `[(ngModel)]` and plain `value` are
  // interchangeable. `setDisabledState` is omitted — the design has no disabled
  // Trigger; with more time it would toggle a disabled state on the Trigger.

  private onChange: (value: DateRange | null) => void = () => {
    /* no-op until a form registers via registerOnChange */
  };
  private onTouched: () => void = () => {
    /* no-op until a form registers via registerOnTouched */
  };

  /** Form → component: a programmatic value seeds the committed Range. */
  writeValue(value: DateRange | null): void {
    this.committed.set(value);
  }

  registerOnChange(fn: (value: DateRange | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
}
