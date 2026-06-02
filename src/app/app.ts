import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { DateRangePicker } from './date-range-picker/date-range-picker';
import type { DateRange } from './date-range-picker/date-range.types';

/**
 * The demo shell (slice 08). Not a library component — it stays `app-*` (the
 * `bloom-*` vendor prefix is reserved for the shippable picker, JUSTIFICATION
 * §9). It renders the picker in its two developer-facing integration modes
 * (JUSTIFICATION §4/§7), which also exercises per-instance identity (counter
 * `uid` → anchor names + ARIA ids; §7) for real:
 *
 * - **Uncontrolled** — no `value` bound; the picker owns its committed state and
 *   the Trigger updates on Apply without the parent tracking anything.
 * - **Controlled** — `value` is bound to {@link controlledRange} and echoed back
 *   on every `applied`, so the parent is the single source of truth.
 */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DateRangePicker],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  /**
   * Parent-owned state for the controlled picker: bound in via `[value]` and
   * written back on every `(applied)`. Seeded with the design's compact example.
   */
  protected readonly controlledRange = signal<DateRange>({
    start: Temporal.PlainDate.from('2024-01-10'),
    end: Temporal.PlainDate.from('2024-02-09'),
  });
}
