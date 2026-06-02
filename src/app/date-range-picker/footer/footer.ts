import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

/**
 * `Footer` (slice 06) — the presentational summary + action bar. It owns no
 * picker state: the root feeds the verbose `summary`, the inclusive `dayCount`
 * and `canApply` in, and reacts to `apply` / `cancel` (JUSTIFICATION §9).
 *
 * The timezone is a **display-only** label read from `Intl` here — it never
 * participates in date math and is not part of the emitted value
 * (JUSTIFICATION §1), so reading it locally keeps the root's wiring to the three
 * state inputs while the footer stays a pure projection of its inputs + the
 * ambient locale.
 *
 * **Lifetime** is signalled by a `null` `dayCount`: the summary already reads
 * just "Lifetime" (the root's verbose formatter) and the meta line drops the
 * day count so an open-ended range is never misrepresented as a fixed span
 * (PRD user story 25).
 */
@Component({
  selector: 'app-drp-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="drp-footer">
      <div class="drp-footer__summary">
        <span class="drp-footer__range">{{ summary() }}</span>
        <span class="drp-footer__meta">{{ meta() }}</span>
      </div>
      <div class="drp-footer__actions">
        <button type="button" class="drp-footer__cancel" (click)="dismiss.emit()">Cancel</button>
        <button
          type="button"
          class="drp-footer__apply"
          [disabled]="!canApply()"
          (click)="apply.emit()"
        >
          Apply
        </button>
      </div>
    </div>
  `,
  styleUrl: './footer.css',
})
export class Footer {
  /** Verbose summary of the draft Range (`Sunday, 1 October 2023 – …`), or "Lifetime". */
  readonly summary = input.required<string>();
  /** Inclusive day count; `null` for Lifetime (open-ended) or an empty draft — no count shown. */
  readonly dayCount = input.required<number | null>();
  /** Whether a Range exists (or Lifetime is active) — gates the Apply button. */
  readonly canApply = input.required<boolean>();

  readonly apply = output<void>();
  /** `dismiss`, not `cancel`: `cancel` is a native DOM event (`@angular-eslint/no-output-native`). */
  readonly dismiss = output<void>();

  /** Display-only timezone label (JUSTIFICATION §1); not configurable, not emitted. */
  protected readonly timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  /**
   * The meta line: `"<n> days, <timezone>"`, the timezone alone for Lifetime, or
   * empty when nothing is selected — a bare timezone under an empty summary reads
   * as noise, so the whole line is suppressed until there is a Range to qualify.
   */
  protected readonly meta = computed(() => {
    if (this.summary() === '') {
      return '';
    }
    const count = this.dayCount();
    if (count === null) {
      return this.timezone;
    }
    const days = count === 1 ? '1 day' : `${count} days`;
    return `${days}, ${this.timezone}`;
  });
}
