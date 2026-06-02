import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { DateRange } from '../date-range.types';
import { buildMonthGrid } from '../date-range.util';

/** A single rendered day cell, with every per-cell visual flag pre-computed. */
interface DayCell {
  date: Temporal.PlainDate;
  iso: string;
  day: number;
  inCurrentMonth: boolean;
  isStart: boolean;
  isEnd: boolean;
  isInRange: boolean;
  isToday: boolean;
}

/** Sunday-first weekday headers (`S M T W T F S`); keys disambiguate the repeats. */
const WEEKDAYS = [
  { key: 'sun', short: 'S' },
  { key: 'mon', short: 'M' },
  { key: 'tue', short: 'T' },
  { key: 'wed', short: 'W' },
  { key: 'thu', short: 'T' },
  { key: 'fri', short: 'F' },
  { key: 'sat', short: 'S' },
] as const;

const CAPTION_OPTS: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' };

/**
 * `MonthGrid` (slice 04) — the one reusable, presentational calendar unit,
 * rendered twice by the root (left = `viewMonth`, right = `viewMonth + 1`). It
 * owns only its per-cell flags (in-range, start, end, today); all selection
 * state lives on the root, which feeds the highlighted Range (draft *or* live
 * preview) in via `range` and reacts to `daySelect` / `dayHover`.
 *
 * Days are `<button>`s here so the grid is keyboard-operable by default in this
 * slice. Slice 07 converts them to the `role="gridcell"` roving-tabindex model
 * (JUSTIFICATION §8 A) and layers on the full ARIA grid + accessible names.
 */
@Component({
  selector: 'app-month-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="drp-month">
      <div class="drp-month__caption">{{ caption() }}</div>
      <div class="drp-month__weekdays" aria-hidden="true">
        @for (wd of weekdays; track wd.key) {
          <span class="drp-month__weekday">{{ wd.short }}</span>
        }
      </div>
      <div class="drp-month__grid" (mouseleave)="dayHover.emit(null)">
        @for (cell of cells(); track cell.iso) {
          <!--
            data-date is unique within one grid but NOT across the two months the
            root renders: an overflow day (e.g. 1 Mar trailing in Feb) repeats as
            an own day next door. Scope any document-wide lookup to one .drp-month.
          -->
          <button
            type="button"
            class="drp-day"
            [class.drp-day--outside]="!cell.inCurrentMonth"
            [class.drp-day--start]="cell.isStart"
            [class.drp-day--end]="cell.isEnd"
            [class.drp-day--in-range]="cell.isInRange"
            [class.drp-day--today]="cell.isToday"
            [attr.data-date]="cell.iso"
            (click)="daySelect.emit(cell.date)"
            (mouseenter)="dayHover.emit(cell.date)"
          >
            {{ cell.day }}
          </button>
        }
      </div>
    </div>
  `,
  styleUrl: './month-grid.css',
})
export class MonthGrid {
  /** The month this grid renders. */
  readonly month = input.required<Temporal.PlainYearMonth>();
  /** The Range to highlight — the root's draft or live preview; `null` = none. */
  readonly range = input<DateRange | null>(null);
  /** Today, for the today-marker (injected by the root so it stays testable). */
  readonly today = input.required<Temporal.PlainDate>();

  readonly daySelect = output<Temporal.PlainDate>();
  readonly dayHover = output<Temporal.PlainDate | null>();

  protected readonly weekdays = WEEKDAYS;

  protected readonly caption = computed(() =>
    this.month().toPlainDate({ day: 1 }).toLocaleString('en-GB', CAPTION_OPTS),
  );

  /**
   * The month skeleton, rebuilt only when the month itself changes — kept
   * separate from `cells()` so a hover (which only moves `range`) re-maps the
   * flags without regenerating the grid. Flattened: CSS lays the 7 columns out.
   */
  private readonly skeleton = computed(() => buildMonthGrid(this.month()).flat());

  protected readonly cells = computed<DayCell[]>(() => {
    const range = this.range();
    const today = this.today();
    return this.skeleton().map(({ date, inCurrentMonth }) =>
      this.toCell(date, inCurrentMonth, range, today),
    );
  });

  private toCell(
    date: Temporal.PlainDate,
    inCurrentMonth: boolean,
    range: DateRange | null,
    today: Temporal.PlainDate,
  ): DayCell {
    // `range.start` is null only for Lifetime, which highlights nothing (§5) —
    // guard both endpoints so a `{ null, T }` range paints neither circle.
    const isStart = range?.start != null && date.equals(range.start);
    const isEnd = range?.start != null && date.equals(range.end);
    const isInRange =
      range?.start != null &&
      Temporal.PlainDate.compare(date, range.start) > 0 &&
      Temporal.PlainDate.compare(date, range.end) < 0;
    return {
      date,
      iso: date.toString(),
      day: date.day,
      inCurrentMonth,
      isStart,
      isEnd,
      isInRange,
      isToday: date.equals(today),
    };
  }
}
