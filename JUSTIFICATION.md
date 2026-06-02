# Justification

Decisions and their rationale, recorded as they're made during planning. Source material for the README write-up later.

## 1. A range is calendar dates, not datetimes; timezone is a display-only label

**Decision.** Model a Range as a pair of **inclusive calendar dates** (start day, end day) with **no time-of-day**. The timezone is a **display-only label** in the footer, read from the browser via `Intl.DateTimeFormat().resolvedOptions().timeZone` (not configurable — see §3).

**Why.**

- The design's two trigger inputs are date-only (`10 Jan 2024 - 9 Feb 2024`). The assignment never mentions time. There is no time-input control anywhere in the design.
- The `00:00` / `16:33` in the footer summary is treated as designer cruft: `00:00` is just start-of-day, `16:33` is "now" at mock time. Reproducing a time-of-day the user can never set would be misleading.
- Once time-of-day is gone, **timezone stops participating in any math** — the inclusive day-count between two calendar dates is timezone-independent. So TZ is purely the informational tail in the footer (`30 days, Europe/Bratislava`) and needs **no TZ library**.

**Consequences.**

- The component emits calendar dates. Resolving dates → absolute instants for a backend query is the consumer's job, in whatever zone they choose. Clean boundary.
- Deliberate deviation from the PNG footer (drops `at HH:MM`). Call this out in the README.

## 2. Native Temporal API (`Temporal.PlainDate`) — no date library

**Decision.** Use the **native Temporal API**. Model a Range endpoint as `Temporal.PlainDate`. No date utility library, and **no polyfill shipped to the browser** (a dev/test-only polyfill covers Node 22 + TS 5.9 — see §12).

**Why.**

- `Temporal.PlainDate` _is_ our model: a calendar date with no time and no timezone, **by construction**. It eliminates native `Date`'s midnight/offset ambiguity. `Range = { start: PlainDate; end: PlainDate }` is self-documenting.
- One model covers everything we need — arithmetic (`.add` / `.subtract` / `.until`), boundaries (`.with({ day: 1 })`), weekday (`.dayOfWeek`), and `Intl` formatting (`.toLocaleString`) for both display formats. No separate date or format lib.
- Standards-native: Stage 4 (in the next ECMAScript), shipped in Chrome/Edge 144, Firefox 139, Node 26.

**Browser support / Safari gap.** As of mid-2026 every major engine ships Temporal **except Safari** (~67% global; Safari has it only in Tech Preview behind a flag). The assignment specifies **no browser-compatibility target** and scope is **desktop ≥1280px**. We therefore target evergreen Chromium + Firefox (`.browserslistrc`) and treat the Safari gap exactly like narrow-screen layouts: **out of scope**. A drop-in polyfill (`temporal-polyfill` ~16 KB gz, or `@js-temporal/polyfill`) closes it in production; wiring it is intentionally not done here. Flagged in the README.

**Notes.**

- `.dayOfWeek` is ISO (Mon=1…Sun=7); the Sunday-start grid uses a one-line modulo.
- `toLocaleString` options are pinned so output is date-only (no era/time).

**Rejected: date-fns.** The conservative, works-everywhere pick (small, tree-shakeable, mature) — but still native-`Date` underneath, so _we_ manage the ambiguity, and it's a weaker signal than the standard. Given no compat target is required, Temporal is the better statement.

**Rejected: native `Intl` + hand-rolled helpers.** Bug-prone date math we'd own; Temporal gives the same zero-dep footprint without the hand-rolling.

## 3. Minimal public contract; no min/max bounds

**Decision.** Keep the component's surface minimal.

- **Output:** `applied` emits `{ start: Temporal.PlainDate | null; end: Temporal.PlainDate }` — nothing more. Also `console.log`ged on Apply (assignment requirement). `start` is nullable solely to represent **Lifetime** (open-ended, no lower bound) — see §5.
- **Inputs:** `value: DateRange | null` and `label: string` (**required** — every design variant has a label). No `timeZone` input — the footer label is read from `Intl` internally.
- **No `minDate`/`maxDate`.** Not declared, not stubbed, not mentioned.

**Why.**

- 6h non-production assignment. The emitted preset id and a configurable timezone were speculative analytics/host features with no basis in the assignment or design — cut them.
- Disabled dates / selectable bounds appear nowhere in the assignment or design. Declaring even a deferred stub is scope we don't need; omit entirely to avoid signalling unfinished work.

**Note.** The active **Preset** is still tracked as internal UI state (to bold + checkmark the sidebar and flip to Custom range on manual selection). Internal state ≠ public contract — it just isn't emitted.

## 4. Signal state shape

**Stored signals:** `isOpen`, `draftStart`/`draftEnd` (`PlainDate | null`), `selectionPhase` (`'awaiting-end' | 'complete'`), `hoveredDate`, `activePreset`, `viewMonth` (`PlainYearMonth`; right calendar = `viewMonth.add({ months: 1 })`), and `committed = linkedSignal(() => value())`.

**Computed (never stored):** `selecting` (`selectionPhase === 'awaiting-end'`), `previewRange` (`draftStart`↔hover while selecting), `effectiveRange` (the draft range or live preview — what the calendar highlights), `summaryText`, `dayCount` (inclusive, `+1`), `canApply` (a range exists, or Lifetime).

**Decisions.**

- **Controlled + uncontrolled via `linkedSignal`.** `committed` mirrors the `value` input yet is locally writable on Apply, so the trigger updates even if the host doesn't echo `value` back. Works either way.
- **`activePreset` is stored, not derived.** A manual selection flips to Custom range even when the dates happen to equal a preset — so it can't be a pure function of the range; it's set on preset click, reset to `'custom'` on manual edit.
- **Open-time init in the toggle handler, not an `effect`.** Seeding the draft from `committed` on open is explicit and predictable. `effect` is reserved for true side-effects only (focus management on open, the `console.log` on Apply) — avoids zoneless/OnPush effect foot-guns.
- **`seedDraft` has three cases, so every committed range round-trips on reopen.** A **dated** range restores its endpoints and focuses its start month (no named preset — the preset id isn't persisted, §3). **Lifetime** (committed but `start === null`) restores the open-ended draft _and_ re-activates the `lifetime` preset, so reopening shows "Lifetime", keeps Apply enabled, and re-checks the sidebar radio. **Empty** opens a clean draft on today's window. (Earlier the Lifetime case fell through to empty, silently dropping the selection on reopen — fixed in slice 06.)

**Selection dance (camp B — always a valid range, see §11).** A click while `selectionPhase === 'complete'` (or on open) **starts fresh**: `draftStart = draftEnd = clicked`, phase → `'awaiting-end'` — already a valid 1-day range, so Apply is enabled. A click while `'awaiting-end'` **extends**: sets the far endpoint (auto-swapping if earlier than `draftStart`), phase → `'complete'`. Hover during `'awaiting-end'` drives `previewRange`. Any manual click also sets `activePreset = 'custom'`.

## 5. Preset → range mapping

`T = Temporal.Now.plainDateISO()` (today, browser zone). Week starts Sunday — `weekStart(d) = d.subtract({ days: d.dayOfWeek % 7 })` (ISO `dayOfWeek` Sun=7 → 0).

| Preset       | start                          | end    |
| ------------ | ------------------------------ | ------ |
| Today        | `T`                            | `T`    |
| Yesterday    | `T.subtract({ days: 1 })`      | same   |
| This week    | `weekStart(T)`                 | `T`    |
| This month   | `T.with({ day: 1 })`           | `T`    |
| This year    | `T.with({ month: 1, day: 1 })` | `T`    |
| Last 7 days  | `T.subtract({ days: 6 })`      | `T`    |
| Last 14 days | `T.subtract({ days: 13 })`     | `T`    |
| Last 30 days | `T.subtract({ days: 29 })`     | `T`    |
| Last 90 days | `T.subtract({ days: 89 })`     | `T`    |
| Lifetime     | `null`                         | `T`    |
| Custom range | manual                         | manual |

**Decisions.**

- **Last N days = `[T-(N-1) .. T]`, inclusive, including today.** Confirmed directly by the design footer example ("1 October – 30 October (30 days)" = Last 30 days ending today).
- **This week / month / year are "to-date" (end = `T`), not full-period.** This is an analytics-style picker; future days hold no data, and to-date is consistent with Last-N.
- **Lifetime is open-ended: `start = null`.** The component has no `minDate`, so it cannot know "the beginning"; a concrete start would be a lie and a far-past sentinel renders an absurd footer. Footer shows just "Lifetime" (no day count); calendar highlights nothing. This is the sole reason `DateRange.start` is nullable (§3).

## 6. Popover via native Popover API + CSS Anchor Positioning — no overlay library

**Decision.** The panel is a native `popover="auto"` element, positioned with **CSS Anchor Positioning**. No CDK Overlay, no Floating UI, no JS positioning.

**Why.**

- `popover="auto"` gives us, for free and across all targets (Chrome/Edge 114+, Firefox 125+): **top-layer rendering** (escapes `overflow`/stacking contexts — no z-index wars), **light-dismiss** (click-outside), **Esc-to-close**, and **focus return to the trigger** on close.
- **CSS Anchor Positioning** (`anchor-name` on trigger, `position-anchor` + `position-area` on panel, `@position-try` to flip near viewport edges) positions the panel with **zero JS**. It's the maximal modern-CSS statement the brief calls for.
- Together they satisfy the "no UI library" constraint by leaning entirely on the platform.

**Cost — Firefox floor 139 → 147.** Temporal shipped in FF 139 but CSS Anchor Positioning only in FF 147. We use both, so the effective floor is 147 (well in the past by mid-2026). Recorded in `.browserslistrc`. Chrome/Edge 144 and Safari 26 both already have anchor positioning (Safari moot — excluded by Temporal anyway).

**Dismiss & focus.** Click-outside + Esc + focus-return are free via `popover="auto"`. On open we move focus into the panel (selected day, else today). **No focus trap** — `popover="auto"` is non-modal, matching the floating, non-dimmed design (there is no backdrop).

**No `inert`.** `inert` would only make sense to simulate a _modal_ trap by disabling the background while open — which contradicts the deliberate non-modal, non-dimmed choice above. A genuinely modal picker would use `<dialog>`, not `inert`-on-background; the design shows neither backdrop nor modality, so we stay non-modal and skip `inert`.

**Rejected: CDK Overlay / Floating UI.** Unnecessary dependencies once the platform covers top-layer + dismiss + positioning, and they brush the "no UI library" line.

## 7. Per-instance identity & form integration

**Multiple instances on one page must not collide.** CSS `anchor-name` is a document-scoped reference, and ARIA-wiring `id`s (`for`/`id` on the label, `aria-controls`, `aria-labelledby`, `aria-describedby`) must be unique per instance — otherwise popover B can anchor to trigger A and AT associations break.

**Decision — counter uid.** Each instance gets `uid = `drp-${nextId++}`` (module-scoped counter; no SSR here, so it's deterministic and collision-free). Everything derives from it: `anchor-name`/`position-anchor` (bound inline as `--${uid}-anchor`) and all DOM ids. Bulletproof regardless of consumer input — no sanitization edge cases.

**Trigger is a `<button>`, not an `<input>`.** You can't meaningfully type a date _range_ into one field; the design's `mm/dd/yyyy` is just the button's empty-state text. The visible "Date picker label" associates via `aria-labelledby`. Consequence: there is **no `name` attribute** and **no hidden input**.

**Form integration — CVA, not a hidden input.** The idiomatic Angular path is `ControlValueAccessor` (`<picker formControlName="…">` / `[(ngModel)]`), which is what Angular DS consumers (e.g. Angular Material) expect — not native `<form>`/`FormData` via a hidden field (rare in Angular; the modern native equivalent, Form-Associated Custom Elements, doesn't apply to a non-custom-element Angular component anyway). Core contract stays `value` input + `applied` output (§3).

**CVA implemented (slice 06).** `NG_VALUE_ACCESSOR` + `forwardRef`; `writeValue` seeds the same locally-writable `committed` signal the `value` input feeds, so `formControlName` / `[(ngModel)]`, controlled, and uncontrolled use are interchangeable. `onChange` fires on Apply. `onTouched` fires on close **only after a real interaction** (day/preset select or Apply) — opening and immediately dismissing leaves the control untouched, matching blur semantics. `setDisabledState` is intentionally omitted (the design has no disabled Trigger); flagged as a with-more-time item.

**Rejected: hidden `<input name value>`.** Non-idiomatic for Angular and unused by typical Angular consumers; it was scope creep over the `value`/`applied` contract. `name`-derived ids were also fragile (sanitization to a `dashed-ident`, non-guaranteed uniqueness) — the counter is strictly safer.

## 8. Accessibility & keyboard model

Based on the WAI-ARIA APG **Date Picker Dialog** pattern, adapted to our non-modal popover. Code standards require passing AXE and WCAG AA.

**Skeleton.**

- **Trigger** `<button>`: `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls={uid}-popover`, `aria-labelledby={uid}-label`; text conveys current value / empty state.
- **Popover** `role="dialog"` + accessible name.
- **Each month** `role="grid"` labelled by its caption; `role="row"` / `role="columnheader"` (S M T…) / `role="gridcell"`. `aria-current="date"` on today; `aria-selected` on start/end/in-range. Day cells carry a full accessible label ("10 January 2024, range start").
- Prev/next arrows `aria-label`led; decorative icons `aria-hidden`.
- **Polite live region** (visually hidden) announces _discrete_ events only (start selected; range completed with day count; preset applied; month window changed) — **not** hover, to avoid announcement spam.
- **Focus** on open → selected day, else today. Esc-close + focus-return are free from the Popover API.
- **Contrast** AA, verified via AXE during build.
- Arrow nav at a visible edge **shifts the two-month window** (`viewMonth`) and lands focus on the adjacent day — keyboard and `viewMonth` are coupled.

**Decisions.**

- **A — gridcell-is-focusable.** The `gridcell` itself is the roving-tabindex target (holds the day, click handler, `tabindex` 0/-1); no nested `<button>` (APG forbids focusables inside a focusable gridcell). Canonical, leaner DOM.
- **B — presets are a `radiogroup`.** Mutually exclusive with a checked state (bold + ✓ in the design) → `radiogroup` + `aria-checked`, roving tabindex, arrow-key nav, one tab stop. Honest single-select semantics.
- **C — non-modal, no focus trap.** `popover="auto"` matches the non-dimmed design; Tab can leave the panel (valid, AXE-clean). **Trade-off documented**; focus containment / modal `<dialog>` variant is a with-more-time item.
- **D — keyboard subset.** In scope: ←→ (day), ↑↓ (week), Home/End (week edges), PageUp/PageDown (month), Enter/Space (select), Esc (close). Deferred with a code comment: Shift+PageUp/Down (year jump) and other exotic APG shortcuts.

## 9. Component decomposition

**Container / presentational split.** One smart root owns all state; children are pure I/O, all `OnPush` + signals.

```
date-range-picker/
  date-range-picker.ts   SMART root, public component. Owns all signals
                         (isOpen, draftStart/End, hovered, activePreset, viewMonth,
                         committed). Public API: value, label, applied. CVA-ready.
                         Renders trigger + calendar header INLINE. Owns open/close,
                         apply/cancel, preset/day logic, keyboard, live-region.
  month-grid/            PRESENTATIONAL, the one reusable unit, rendered TWICE
                         (left = viewMonth, right = viewMonth+1). role="grid".
                         Owns its per-cell state via computed → buildMonthGrid(...).
                         in: month, range, hovered, focused, today.
                         out: daySelect, dayHover, focusedChange.
  presets-list/          PRESENTATIONAL radiogroup. in: activePreset. out: presetSelect.
  footer/                PRESENTATIONAL. in: summary, dayCount, canApply.
                         out: apply, dismiss. Reads its own Intl timezone label.
  date-range.types.ts    DateRange, PresetId
  date-range.util.ts     pure (Temporal-only, no Angular): weekStart, buildMonthGrid,
                         formatCompact, formatVerbose, dayCount
  presets.ts             preset list + range mapping (§5)
```

**Decisions.**

- **4 components total** (root + month-grid + presets-list + footer). **Trigger and calendar header inline in root** (Fork A/B): trivial markup, no reuse, and inlining simplifies `popovertarget` / `aria-controls` / CVA wiring; a wrapper would only forward `viewMonth` state.
- **`MonthGrid` is the single reusable unit, rendered twice**; it owns cell-level flags so the root never deals in them.
- **All date logic is pure util/`presets`**, Temporal-only — directly unit-testable as a clean interface (testing rule: behavior via the public interface).
- **Root is the only stateful component**; CVA, live-region, open/close, apply/cancel, keyboard coordination all live there.
- **Selectors carry the `bloom-` vendor prefix.** The shippable library component is `bloom-date-range-picker`; its internal presentational parts keep a `drp` sub-namespace — `bloom-drp-month-grid`, `bloom-drp-presets-list`, `bloom-drp-footer`. The Angular CLI default `app-` means "application-local component", which is wrong for a reusable DS component; a vendor prefix is the established convention (Material `mat-`, CDK `cdk-`). The demo shell stays `app-*`, so the prefix meaningfully distinguishes app-local from library. ESLint is set to `prefix: ['app', 'bloom']` to allow both. This mirrors the `--bloom-*` token convention (§10) — one vendor namespace across selectors and theming surface.

## 10. CSS token & layer architecture

Vanilla CSS, design tokens as custom properties, `@layer` cascade layers — the deliberate choice from the brief (team is on SCSS, eyeing a CSS migration). Document this in the README.

**Layers** declared up front so source order stops mattering:

```css
@layer reset, tokens, components, utilities;
```

**Two-tier tokens.**

- **Primitive/global** on `:root` in the `tokens` layer — raw palette + scale (`--teal-500`, `--blue-100`, `--yellow-400`, spacing, radii, font sizes).
- **Semantic/component** scoped to the component, referencing primitives (`--drp-range-endpoint-bg: var(--teal-500)`, etc.). **Semantic tokens are the public theming surface** — consumers re-theme by overriding them, never reaching into internals.
- **Production note:** in a real shared library these would carry a vendor prefix (e.g. `--bloom-*`) to prevent collisions / leakage with host sites and third-party libraries. For this assignment the semantic tokens still use the short `--drp-*` prefix and the `--bloom-*` convention is called out as the production path. (Selectors _have_ adopted the `bloom-` vendor prefix — see §9 — so the token migration is the remaining half; deferred because every component's CSS references `--drp-*` and the rename is mechanical busywork the README documents instead.)

**Modern CSS used (on-brand for the role):** `color-mix()` for derived hover/active shades, `:has()` where it earns its keep (e.g. range-band edge rounding from neighbor state), and native nesting for component-scoped rules.

**Dark mode out of scope.** `light-dark()` + `color-scheme` would be the path, but the design is light-only — flagged as a with-more-time item, not built.

**Emulated ViewEncapsulation** (Angular default; attribute-scoped) per component, with global `reset`/`tokens` in `src/styles.css`. **Not** Shadow DOM — it complicates token inheritance and interaction with the popover top-layer.

## 11. Interaction micro-decisions

- **Selection model: camp B — "always a valid range."** First click (or any click on a completed range) sets a 1-day range (`start === end`) and Apply is immediately enabled; the next click extends it. Drives the `selectionPhase` flag in §4. This is the prevalent modern-picker UX (react-date-range, MUI DateRangePicker) and avoids an incomplete/limbo state. The only downside — an accidental single-day apply — is negligible since Apply is a deliberate press.
- **Single-day range allowed.** `start === end`, day count 1. Click a day then Apply.
- **`canApply`.** Enabled whenever a range exists (camp B → as soon as one day is clicked) or when Lifetime is active. Disabled only for an empty/null selection.
- **Default `viewMonth` when `value` is null.** Today's month on the left, next month on the right (matches the design's framing).
- **Clicking the "Custom range" preset directly is a no-op.** It only ever activates reactively, via manual day selection.
- **Footer weekday.** Verbose footer includes the weekday (`Sunday, 1 October 2023`); the compact trigger does not (`10 Jan 2024`).
- **Tests.** Assignment doesn't require tests, but we demo TDD: prioritise pure `date-range.util` / `presets` unit tests (the clean interface from §9), plus a few component interaction tests if the box allows.

## 12. Temporal in dev & test (Node 22, TS 5.9)

**Context.** Pinned Node is **22** (Angular 21 supports `^20.19 || ^22.12 || ^24`; Node 26 is out of matrix) and pinned TypeScript is **5.9**. Node 22 has **no native `Temporal` runtime** (it landed in Node 26) and **TS 5.9 has no `Temporal` types** (they arrive in TS 6.0, which Angular 21 doesn't permit). Meanwhile the browser (Chrome 144+ / FF 147+) has native Temporal, and the build is a static SPA with **no SSR**, so `ng build` never executes Temporal.

**Decision — `temporal-polyfill` as a devDependency, double duty:**

- **Types:** a `global.d.ts` does `import type { Temporal } from 'temporal-polyfill'` + `declare global` so the native `Temporal` global is typed at compile time. `import type` is erased — no runtime import, nothing shipped.
- **Test runtime:** a vitest setup file imports the polyfill so `Temporal` exists when tests run in Node 22.

**Consequences.**

- The **browser bundle ships native Temporal, zero polyfill** — consistent with ADR-0001 / §2 ("no polyfill" = not shipped to the browser).
- Node stays at **22** (Angular-supported; Netlify's default — and Netlify only _builds_, never runs Temporal).
- Drop the devDep entirely once Angular allows TS 6.0 (native types) and the runtime/test floor reaches Node 26.

**Rejected: bumping Node to 26.** Outside Angular 21's support matrix, unconfirmed on Netlify, and — because TS 5.9 still lacks Temporal _types_ — it wouldn't even remove the devDep. Strictly more risk for zero dependency saving.
