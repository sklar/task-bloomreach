import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import type { PresetId } from '../date-range.types';
import { PRESETS } from '../presets';

/**
 * `PresetsList` (slice 05) — the presentational presets sidebar, a `radiogroup`
 * of named shortcuts (JUSTIFICATION §8 B). Mutually-exclusive single-select with
 * a checked state (bold + ✓ in the design) → `role="radio"` + `aria-checked`.
 *
 * It owns no state: the root feeds the `activePreset` in and reacts to
 * `presetSelect`, then maps the chosen id to a Range (slice-02 mapping) and
 * updates the calendar. Clicking the already-active "Custom range" entry — or
 * any "Custom range" click — is handled by the root as a no-op; Custom only ever
 * activates reactively, via manual day selection (JUSTIFICATION §11).
 *
 * Roving tabindex makes the group a single tab stop: the active radio is
 * tabbable, falling back to the first when none is active. Arrow keys move the
 * selection within the group (radio pattern — moving focus also selects), keyed
 * off the host on the radiogroup (JUSTIFICATION §8 B/D).
 *
 * "Custom range" is skipped by arrow nav: it activates only reactively, via
 * manual day selection (JUSTIFICATION §11), so it is never an arrow-key target.
 */
@Component({
  selector: 'bloom-drp-presets-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Arrow-key handling lives on the host (delegated from the focusable radios), so
  // it composes with the roving tabindex without a non-focusable keydown target.
  host: { '(keydown)': 'onKeydown($event)' },
  template: `
    <div role="radiogroup" aria-label="Date range presets" class="drp-presets">
      @for (preset of presets; track preset.id) {
        <button
          type="button"
          role="radio"
          class="drp-preset"
          [class.drp-preset--active]="preset.id === activePreset()"
          [attr.aria-checked]="preset.id === activePreset()"
          [attr.tabindex]="preset.id === tabbableId() ? 0 : -1"
          (click)="presetSelect.emit(preset.id)"
        >
          <span class="drp-preset__label">{{ preset.label }}</span>
          @if (preset.id === activePreset()) {
            <span class="drp-preset__check" aria-hidden="true">✓</span>
          }
        </button>
      }
    </div>
  `,
  styleUrl: './presets-list.css',
})
export class PresetsList {
  /** The active Preset; `null` = none chosen yet (no radio checked). */
  readonly activePreset = input<PresetId | null>(null);

  readonly presetSelect = output<PresetId>();

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly presets = PRESETS;

  /** The single tabbable radio: the active one, else the first (roving tabindex). */
  protected readonly tabbableId = computed<PresetId>(() => this.activePreset() ?? PRESETS[0].id);

  /**
   * Arrow-key radio navigation: Down/Right → next, Up/Left → previous, wrapping
   * and skipping "custom" (not directly selectable). Moving selects (radio
   * pattern) and moves DOM focus to the new radio so it stays a single tab stop.
   */
  protected onKeydown(event: KeyboardEvent): void {
    const forward = event.key === 'ArrowDown' || event.key === 'ArrowRight';
    const backward = event.key === 'ArrowUp' || event.key === 'ArrowLeft';
    if (!forward && !backward) {
      return;
    }
    event.preventDefault();

    const step = forward ? 1 : -1;
    const start = PRESETS.findIndex((preset) => preset.id === this.tabbableId());
    let index = start;
    do {
      index = (index + step + PRESETS.length) % PRESETS.length;
    } while (PRESETS[index].id === 'custom' && index !== start);

    this.presetSelect.emit(PRESETS[index].id);
    const radios = this.el.nativeElement.querySelectorAll<HTMLElement>('[role="radio"]');
    radios[index]?.focus();
  }
}
