import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
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
 * tabbable, falling back to the first when none is active. Full arrow-key
 * navigation within the group lands in slice 07 (JUSTIFICATION §8 D).
 */
@Component({
  selector: 'bloom-drp-presets-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
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

  protected readonly presets = PRESETS;

  /** The single tabbable radio: the active one, else the first (roving tabindex). */
  protected readonly tabbableId = computed<PresetId>(() => this.activePreset() ?? PRESETS[0].id);
}
