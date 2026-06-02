import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Renderer2,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import type { DateRange } from './date-range.types';
import { formatCompact } from './date-range.util';

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
      <!-- Panel content (two-month calendar, presets, footer) filled by later slices. -->
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
    this.isOpen.set(true);
    // Top-layer render in the browser; a no-op where the Popover API is absent.
    const panel = this.panelRef().nativeElement as HTMLElement & { showPopover?: () => void };
    try {
      panel.showPopover?.();
    } catch {
      /* already open / unsupported */
    }
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
