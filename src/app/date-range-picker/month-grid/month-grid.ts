import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { DateRange } from '../date-range.types';
import { buildMonthGrid } from '../date-range.util';

/** A single rendered day cell, with every per-cell visual + a11y flag pre-computed. */
interface DayCell {
  date: Temporal.PlainDate;
  iso: string;
  day: number;
  inCurrentMonth: boolean;
  isStart: boolean;
  isEnd: boolean;
  isInRange: boolean;
  isToday: boolean;
  /** True for the one roving-tabindex target (the focused day in *this* month). */
  isFocused: boolean;
  /** Any of start/end/in-range → `aria-selected="true"`. */
  isSelected: boolean;
  /** Full accessible name: date + state, e.g. "10 January 2024, range start". */
  label: string;
}

/** One `role="row"` of seven day cells, keyed by its Sunday for `@for` tracking. */
interface WeekRow {
  key: string;
  cells: DayCell[];
}

/** Sunday-first weekday headers; `short` is the visible letter, `full` the a11y name. */
const WEEKDAYS = [
  { key: 'sun', short: 'S', full: 'Sunday' },
  { key: 'mon', short: 'M', full: 'Monday' },
  { key: 'tue', short: 'T', full: 'Tuesday' },
  { key: 'wed', short: 'W', full: 'Wednesday' },
  { key: 'thu', short: 'T', full: 'Thursday' },
  { key: 'fri', short: 'F', full: 'Friday' },
  { key: 'sat', short: 'S', full: 'Saturday' },
] as const;

const CAPTION_OPTS: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' };
/** Day labels read the full date without a weekday (the columnheader carries the weekday). */
const LABEL_OPTS: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };

/** Module-scoped counter so each rendered grid gets a unique caption id (two per picker). */
let nextGridId = 0;

/**
 * Full accessible name for a day: the date, then its range state, then "today" if
 * applicable — e.g. "10 January 2024, range start, today" (PRD user story 47).
 */
function dayLabel(
  date: Temporal.PlainDate,
  isStart: boolean,
  isEnd: boolean,
  isInRange: boolean,
  isToday: boolean,
): string {
  const states: string[] = [];
  if (isStart && isEnd) {
    states.push('selected');
  } else if (isStart) {
    states.push('range start');
  } else if (isEnd) {
    states.push('range end');
  } else if (isInRange) {
    states.push('in range');
  }
  if (isToday) {
    states.push('today');
  }
  const base = date.toLocaleString('en-GB', LABEL_OPTS);
  return states.length ? `${base}, ${states.join(', ')}` : base;
}

/**
 * `MonthGrid` (slice 04, a11y in slice 07) — the one reusable, presentational
 * calendar unit, rendered twice by the root (left = `viewMonth`, right =
 * `viewMonth + 1`). It owns only its per-cell flags (in-range, start, end, today,
 * focused); all selection + focus state lives on the root, which feeds the
 * highlighted Range (draft *or* live preview) via `range` and the roving-tabindex
 * target via `focused`, and reacts to `daySelect` / `dayHover`.
 *
 * **APG grid (JUSTIFICATION §8 A).** `role="grid"` with a `columnheader` row and
 * `gridcell` day cells; the gridcell *itself* is the focusable roving-tabindex
 * target (no nested `<button>` — APG forbids focusables inside a focusable
 * gridcell). The root drives Arrow/Home/End/PageUp/PageDown/Enter/Space; the cell
 * carries the `tabindex`, the click handler, `aria-current`/`aria-selected`, and a
 * full accessible name.
 */
@Component({
  selector: 'bloom-drp-month-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="drp-month">
      <div [id]="captionId" class="drp-month__caption">{{ caption() }}</div>
      <!-- mouseleave clears hover when the pointer leaves the *whole* month — not
           per-row, which would clear the preview while crossing week boundaries. -->
      <div
        role="grid"
        [attr.aria-labelledby]="captionId"
        class="drp-month__grid"
        (mouseleave)="dayHover.emit(null)"
      >
        <div role="row" class="drp-month__weekdays">
          @for (wd of weekdays; track wd.key) {
            <span role="columnheader" [attr.aria-label]="wd.full" class="drp-month__weekday">{{
              wd.short
            }}</span>
          }
        </div>
        @for (week of weeks(); track week.key) {
          <div role="row" class="drp-month__week">
            @for (cell of week.cells; track cell.iso) {
              <!--
                data-date is unique within one grid but NOT across the two months the
                root renders: an overflow day (e.g. 1 Mar trailing in Feb) repeats as
                an own day next door. Only the in-current-month instance is focusable
                (roving tabindex), so the tabbable cell stays unique across the panel.

                Keyboard activation (Enter/Space) is handled by the root's delegated
                host keydown off the focused gridcell (JUSTIFICATION §8), not a
                per-cell key handler — so the click-events-have-key-events heuristic
                is a false positive here.
              -->
              <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events -->
              <span
                role="gridcell"
                class="drp-day"
                [class.drp-day--outside]="!cell.inCurrentMonth"
                [class.drp-day--start]="cell.isStart"
                [class.drp-day--end]="cell.isEnd"
                [class.drp-day--in-range]="cell.isInRange"
                [class.drp-day--today]="cell.isToday"
                [attr.tabindex]="cell.isFocused ? 0 : -1"
                [attr.aria-selected]="cell.isSelected"
                [attr.aria-current]="cell.isToday ? 'date' : null"
                [attr.aria-label]="cell.label"
                [attr.data-date]="cell.iso"
                (click)="daySelect.emit(cell.date)"
                (mouseenter)="dayHover.emit(cell.date)"
              >
                {{ cell.day }}
              </span>
            }
          </div>
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
  /** The roving-tabindex target; only its in-current-month cell is tabbable. */
  readonly focused = input<Temporal.PlainDate | null>(null);

  readonly daySelect = output<Temporal.PlainDate>();
  readonly dayHover = output<Temporal.PlainDate | null>();

  protected readonly weekdays = WEEKDAYS;

  protected readonly captionId = `drp-grid-${nextGridId++}-caption`;

  protected readonly caption = computed(() =>
    this.month().toPlainDate({ day: 1 }).toLocaleString('en-GB', CAPTION_OPTS),
  );

  /**
   * The month skeleton (weeks of 7), rebuilt only when the month itself changes —
   * kept separate from `weeks()` so a hover or focus move (which only touch
   * `range` / `focused`) re-maps the flags without regenerating the grid.
   */
  private readonly skeleton = computed(() => buildMonthGrid(this.month()));

  protected readonly weeks = computed<WeekRow[]>(() => {
    const range = this.range();
    const today = this.today();
    const focused = this.focused();
    return this.skeleton().map((week) => ({
      key: week[0].date.toString(),
      cells: week.map(({ date, inCurrentMonth }) =>
        this.toCell(date, inCurrentMonth, range, today, focused),
      ),
    }));
  });

  private toCell(
    date: Temporal.PlainDate,
    inCurrentMonth: boolean,
    range: DateRange | null,
    today: Temporal.PlainDate,
    focused: Temporal.PlainDate | null,
  ): DayCell {
    // `range.start` is null only for Lifetime, which highlights nothing (§5) —
    // guard both endpoints so a `{ null, T }` range paints neither circle.
    const isStart = range?.start != null && date.equals(range.start);
    const isEnd = range?.start != null && date.equals(range.end);
    const isInRange =
      range?.start != null &&
      Temporal.PlainDate.compare(date, range.start) > 0 &&
      Temporal.PlainDate.compare(date, range.end) < 0;
    const isToday = date.equals(today);
    return {
      date,
      iso: date.toString(),
      day: date.day,
      inCurrentMonth,
      isStart,
      isEnd,
      isInRange,
      isToday,
      // Roving tabindex targets the *own* day, never an adjacent month's overflow
      // copy, so exactly one cell is tabbable across the two rendered grids.
      isFocused: inCurrentMonth && focused != null && date.equals(focused),
      isSelected: isStart || isEnd || isInRange,
      label: dayLabel(date, isStart, isEnd, isInRange, isToday),
    };
  }
}
