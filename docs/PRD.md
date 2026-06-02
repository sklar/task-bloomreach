# PRD: Date Range Picker

Status: ready-for-agent

A design-system date range picker: a Trigger that opens a popover with a two-month calendar, a Presets sidebar, and a footer summary. Applying emits the selected Range to the consumer. Glossary in `CONTEXT.md`; decisions in `JUSTIFICATION.md` §1–§12; `docs/adr/0001-temporal-over-date-library.md`.

## Problem Statement

As a user of an analytics-style product, I need to choose a date range — either a named shortcut like "Last 30 days" or two specific days — without fiddly typing, and see exactly what I picked (with day count and my timezone) before committing. As a developer on the design-system team, I need this as a reusable, accessible component with a clean contract, not a one-off screen.

## Solution

A `DateRangePicker` component. A Trigger styled like an input shows the Committed range in compact form (`10 Jan 2024 - 9 Feb 2024`) or an empty placeholder (`mm/dd/yyyy`). Activating it opens a non-modal popover anchored to the Trigger containing:

- Two side-by-side month calendars (week starts Sunday) with range selection.
- A scrollable Presets sidebar (Lifetime, Today, Yesterday, This week, This month, This year, Last 7/14/30/90 days, Custom range).
- A footer showing a verbose summary of the Draft range with day count and timezone, plus Cancel and Apply.

Selecting a Preset fills the calendar. Any manual day selection flips the active Preset to Custom range. Apply emits the Range, logs it to the console, commits it to the Trigger, and closes. Cancel reverts to the Committed range and closes. Click-outside and Esc behave like Cancel.

## User Stories

1. As a user, I want a Trigger that looks like an input field, so that I recognise it as something that opens a picker.
2. As a user, I want the Trigger to show my Committed range compactly (`10 Jan 2024 - 9 Feb 2024`), so that I can see my current selection at a glance.
3. As a user, I want the Trigger to show `mm/dd/yyyy` when nothing is selected, so that I know it's empty.
4. As a user, I want a visible label above the Trigger, so that I know what the date range is for.
5. As a user, I want the picker to open in a popover anchored to the Trigger, so that it appears in context.
6. As a user, I want the popover to stay visible above other content regardless of overflow/stacking, so that it's never clipped.
7. As a user, I want two months shown side by side, so that I can select ranges that span a month boundary without paging.
8. As a user, I want the week to start on Sunday (S M T W T F S), so that it matches the regional convention in the design.
9. As a user, I want to click a day to start a Range, so that I can begin a custom selection.
10. As a user, I want my first click to immediately be a valid 1-day Range, so that I can Apply a single day without a second click.
11. As a user, I want my next click to extend the Range to that day, so that I can select a span.
12. As a user, I want the Range to auto-correct if I click an earlier day second, so that order doesn't matter.
13. As a user, I want a live preview band as I hover between clicks, so that I can see the Range I'm about to select.
14. As a user, I want the start and end days shown as solid teal circles and the in-between days as a light-blue band, so that the Range reads clearly (per design).
15. As a user, I want today visually marked, so that I can orient myself.
16. As a user, I want ‹ › arrows to move the two-month window, so that I can reach other months.
17. As a user, I want a Presets sidebar, so that I can pick common ranges in one click.
18. As a user, I want "Today" to select just today, so that I see today's data.
19. As a user, I want "Yesterday" to select just yesterday.
20. As a user, I want "This week" to be Sunday-of-this-week through today (to-date), so that I don't include future empty days.
21. As a user, I want "This month" to be the 1st through today (to-date).
22. As a user, I want "This year" to be Jan 1 through today (to-date).
23. As a user, I want "Last 7/14/30/90 days" to be that many days ending today, including today.
24. As a user, I want "Lifetime" to mean all data with no lower bound, so that I can see everything.
25. As a user, I want the footer to read just "Lifetime" (no day count) when Lifetime is active, so that it's not misrepresented as a fixed span.
26. As a user, I want selecting a Preset to update the calendar selection and view, so that I can see what it chose.
27. As a user, I want the active Preset bold with a checkmark, so that I know which one is selected.
28. As a user, I want any manual day click to switch the active Preset to "Custom range", so that the sidebar reflects that I've gone custom.
29. As a user, I want the Presets list to scroll when it overflows, so that all presets are reachable.
30. As a user, I want a footer summary of the Draft range (verbose, e.g. `Sunday, 1 October 2023 – Monday, 30 October 2023`), so that I can confirm the exact days.
31. As a user, I want the footer to show the day count (inclusive), so that I know the span length.
32. As a user, I want the footer to show my timezone, so that I know which zone the range refers to.
33. As a user, I want an Apply button, so that I can commit my selection.
34. As a user, I want Apply disabled until a Range exists (or Lifetime is active), so that I can't commit nothing.
35. As a user, I want Apply to commit the Range to the Trigger and close the picker, so that my choice sticks.
36. As a user, I want a Cancel button that reverts to my previous selection and closes, so that I can back out.
37. As a user, I want clicking outside the popover to cancel and close, so that I can dismiss it quickly.
38. As a user, I want Escape to cancel and close, so that I can dismiss via keyboard.
39. As a user, I want focus to return to the Trigger when the picker closes, so that I don't lose my place.
40. As a keyboard user, I want focus to move into the calendar (selected day, else today) when the picker opens, so that I can navigate immediately.
41. As a keyboard user, I want arrow keys to move day-by-day and week-by-week, so that I can select without a mouse.
42. As a keyboard user, I want Home/End to jump to the start/end of the week, so that I navigate faster.
43. As a keyboard user, I want PageUp/PageDown to move month-by-month, so that I can reach distant months.
44. As a keyboard user, I want arrow navigation off a visible edge to shift the two-month window, so that navigation is continuous.
45. As a keyboard user, I want Enter/Space to select the focused day, so that I can pick without clicking.
46. As a keyboard user, I want the Presets to be a single-select group I navigate with arrow keys, so that they're one tab stop.
47. As a screen-reader user, I want each day announced with its full date and state (e.g. "10 January 2024, range start"), so that I understand the grid.
48. As a screen-reader user, I want discrete announcements when I start a selection, complete a Range (with day count), apply a Preset, or change the month window, so that I track changes without hover spam.
49. As a screen-reader user, I want the Trigger to expose its expanded/collapsed state and that it controls a dialog, so that the relationship is clear.
50. As a developer, I want to pass a `value` (the Committed range) and a required `label`, so that I can configure the picker.
51. As a developer, I want an `applied` output emitting `{ start, end }`, so that I can react to commits.
52. As a developer, I want Apply to also `console.log` the range, so that I can review selections (assignment requirement).
53. As a developer, I want to place multiple pickers on one page without anchor/ARIA id collisions, so that each works independently.
54. As a developer, I want the picker to work both controlled and uncontrolled, so that the Trigger updates even if I don't echo `value` back.
55. As a developer, I want to re-theme via documented semantic CSS custom properties, so that I can restyle without reaching into internals.
56. As a developer, I want the date/preset logic exposed as pure functions, so that I can rely on (and test) deterministic behavior.

## Implementation Decisions

**Modules built (all under a `date-range-picker/` feature):**

- `DateRangePicker` — smart root, the public component. Owns all signal state; renders Trigger + calendar header inline; owns open/close, apply/cancel, preset/day logic, keyboard coordination, and the live region. CVA-ready (implement if time allows; otherwise a documented stub).
- `MonthGrid` — presentational, the one reusable unit, rendered twice (left = `viewMonth`, right = `viewMonth.add({ months: 1 })`). Owns its per-cell flags.
- `PresetsList` — presentational radiogroup.
- `Footer` — presentational (summary + day count + Cancel/Apply).
- `date-range.util` + `presets` — pure, Temporal-only logic (no Angular).
- `date-range.types` — shared types.

**Public contract:**

```ts
type PresetId =
  | 'lifetime'
  | 'today'
  | 'yesterday'
  | 'this-week'
  | 'this-month'
  | 'this-year'
  | 'last-7-days'
  | 'last-14-days'
  | 'last-30-days'
  | 'last-90-days'
  | 'custom';

interface DateRange {
  start: Temporal.PlainDate | null; // null only for Lifetime (open-ended)
  end: Temporal.PlainDate;
}

// inputs:  value: DateRange | null;  label: string (required)
// output:  applied: DateRange  (+ console.log on Apply)
```

**Dates:** native Temporal API (`Temporal.PlainDate`), no date library (ADR-0001). A Range is inclusive calendar dates, no time-of-day. Timezone is a display-only footer label read from `Intl`, not configurable, not emitted.

**Preset → range mapping** (`T = Temporal.Now.plainDateISO()`, week starts Sunday via `weekStart(d) = d.subtract({ days: d.dayOfWeek % 7 })`): Today `[T,T]`; Yesterday `[T-1,T-1]`; This week `[weekStart(T),T]`; This month `[T.with({day:1}),T]`; This year `[T.with({month:1,day:1}),T]`; Last N `[T-(N-1),T]` (incl. today); Lifetime `[null,T]`; Custom = manual.

**Signal state shape:** stored — `isOpen`, `draftStart`/`draftEnd`, `selectionPhase` (`'awaiting-end' | 'complete'`), `hoveredDate`, `activePreset`, `viewMonth`, `committed = linkedSignal(() => value())`. Computed — `selecting`, `previewRange`, `effectiveRange`, `summaryText`, `dayCount` (inclusive +1), `canApply`. `activePreset` is stored, not derived. Open-time draft init happens in the toggle handler, not an `effect`; `effect` is reserved for side-effects (focus on open, the Apply `console.log`).

**Selection model (camp B — always a valid range), encoded as a pure reducer for testability:**

```
nextSelection(state, clicked):
  if state.phase == 'complete' or state.draftStart == null:
      start = end = clicked;  phase = 'awaiting-end'      // fresh 1-day range
  else: // 'awaiting-end' → extend, swapping if earlier than the anchor
      [start, end] = order(state.draftStart, clicked);  phase = 'complete'
  // any manual click also sets activePreset = 'custom'
```

**Popover & positioning:** native `popover="auto"` (free top-layer, light-dismiss, Esc, focus-return) + CSS Anchor Positioning (`anchor-name` on Trigger, `position-anchor`/`position-area` + `@position-try` on the panel). No CDK Overlay / Floating UI / JS positioning. Non-modal, no focus trap, no `inert`.

**Per-instance identity:** module-scoped counter `uid = drp-${nextId++}` drives the inline `anchor-name`/`position-anchor` and every ARIA-wiring id. Trigger is a `<button>` (no `name`, no hidden input).

**Accessibility:** APG Date Picker Dialog pattern adapted to a non-modal popover. `role="dialog"`; each month `role="grid"` with row/columnheader/gridcell; gridcell-is-focusable with roving tabindex; `aria-current="date"`, `aria-selected`, full day labels; Presets as `radiogroup`; aria-labelled nav arrows; aria-hidden decorative icons; a visually-hidden polite live region for discrete events. Must pass AXE and WCAG AA (including contrast).

**CSS:** vanilla CSS, `@layer reset, tokens, components, utilities`, two-tier tokens (primitive on `:root`; semantic `--drp-*` as the public theming surface). Modern CSS (`color-mix()`, `:has()`, native nesting). Emulated ViewEncapsulation. Light-only.

**Browser targets:** Chrome/Edge ≥144, Firefox ≥147 (`.browserslistrc`). Safari out of scope (no native Temporal). Desktop ≥1280px only.

**Temporal in dev/test (§12):** `temporal-polyfill` as a devDependency — `import type` for the global type (compile-time, erased) and a vitest setup-file runtime shim (Node 22 has no native Temporal). Browser ships native, no polyfill.

## Testing Decisions

Tests assert **external behavior through the public interface only** — never private fields or internal call sequences. They demonstrate TDD (the assignment doesn't require tests, but this is a deliberate showcase). Two seams, highest-first:

**Seam 1 — pure logic (`date-range.util`, `presets`).** The bulk of coverage, no Angular/DOM. Cover: every preset → range mapping (Last-N incl. today, week/month/year to-date, Lifetime → `null` start, Sunday week start); month-grid generation; inclusive `dayCount`; compact + verbose formatting; and the `nextSelection` reducer (fresh / extend / swap transitions and the Custom-range flip). Pure-in/pure-out — assert on returned values.

**Seam 2 — public component (`DateRangePicker`) via Angular TestBed + jsdom.** Drive only through inputs/outputs and DOM events: open/close; click-to-select (1-day then extend); Preset selection updates the calendar selection; manual click flips active Preset to Custom range; Apply emits `{ start, end }`, logs to console, commits to the Trigger, and closes; Cancel reverts and closes; click-outside and Esc behave like Cancel; empty state renders the placeholder; key ARIA wiring (`aria-expanded`, dialog/grid roles, `aria-selected`). Presentational children (`MonthGrid`, `PresetsList`, `Footer`) are **not** unit-tested in isolation — their behavior is verified through the root.

**Prior art:** none — fresh repo (only the default `app.spec.ts`). This PRD establishes the pattern: Vitest runner, jsdom environment, `temporal-polyfill` loaded in the vitest setup file (§12).

## Out of Scope

- Time-of-day selection (a Range is calendar dates only).
- Configurable or emitted timezone (display-only label from `Intl`).
- `minDate`/`maxDate`, disabled days, selectable bounds.
- Emitted preset id and other speculative analytics/host metadata.
- Native `<form>` participation / hidden input (CVA is the form path).
- Safari support (no native Temporal) and shipping a browser polyfill.
- Responsive/mobile/tablet layouts below 1280px.
- Dark mode.
- Routing / multi-page concerns (single showcase page).
- Full APG keyboard set beyond the §8 subset (e.g. Shift+PageUp/Down year jump) — left as a code comment.

## Further Notes

- **Camp-B trade-off:** an accidental single-day Apply is possible but negligible (Apply is a deliberate press); chosen for the always-valid-range UX prevalent in modern pickers.
- **CVA** is the intended Angular form-integration path; implement within the time box if possible, else leave a documented stub at the integration point.
- **README** should document: the vanilla-CSS + `@layer` + tokens choice (team is on SCSS, eyeing CSS migration); the Temporal/Safari support story; the `--bloom-*` token-prefix convention for a real shared library; and the deliberate deviations from the design PNG (no time-of-day in the footer; the "Octover" typo is not reproduced).
- **Design fidelity:** start/end = solid teal circle, in-between = light-blue band; active preset bold + checkmark; yellow Apply with dark text. Verify contrast via AXE.
- Time box: 6 hours. "What I'd do with more time" comments are encouraged for deferred items (CVA, focus containment / modal variant, exotic keyboard shortcuts, min/max, dark mode).
