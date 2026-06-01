# Brief

Context summary to seed a fresh Claude Code "grill-me-with-docs" session.

## What this is

- Take-home for a **Senior UI Developer** role (design-system team).
- Build a **date range picker**, treated as a design-system component, not a one-off screen.
- Time box: **max 6 hours** over 2 days. "What I'd do with more time" comments are encouraged.
- Deliverable: link to a GitHub repo.

Full assignment: [ASSIGNMENT.md](../ASSIGNMENT.md).

## Assignment scope

- Trigger element that opens the picker with proper positioning.
- Two-month calendar with range selection.
- Presets sidebar: Lifetime, Today, Yesterday, This week, This month, This year, Last 7/14/30/90 days, Custom range. Selecting a preset updates the calendar; any manual day selection flips the active preset to **Custom range**.
- Footer: summary of the selected range + **Cancel** + **Apply**.
- **Apply** emits the range _and_ logs it to the console. **Cancel** reverts the selection. Both close the picker.
- Desktop only — no responsive work below 1280px.
- Allowed: a small date utility lib. **Banned: prebuilt picker packages** (e.g. `ngx-daterangepicker`).

## Design notes (from the Figma PNG)

- Week starts **Sunday** (S M T W T F S).
- Range styling: start/end = solid teal circle; in-between days = light-blue band.
- Presets list scrolls; active preset is **bold + checkmark**.
- Footer summary shows **time-of-day and timezone**, e.g. "Sunday, 1 October 2023 at 00:00 – Monday, 30 October 2023 at 16:33 (30 days, Europe/Bratislava)". (Design has a typo, "Octover".)
- Trigger filled-state uses a **different, compact format**: "10 Jan 2024 - 9 Feb 2024".
- ⇒ Two display formats (compact trigger vs verbose footer) + time + timezone to account for.

## Tech decisions (locked)

- **Angular 21** (CLI 21.2.13 installed). v22 is ~launching now; staying on stable LTS 21.
- **Vanilla CSS** — no Sass, no Tailwind. Plan: modern CSS with **design tokens as CSS custom properties + `@layer` cascade layers**; document this as a deliberate choice in the README (the team uses SCSS but is eyeing a CSS migration).
- **No SSR/SSG** (declined the `ng new` prompt). Pure client-side interactivity.
- Routing: omitted (single showcase page).
- **Keep `@angular/forms`** (default dep). Core built on signals + `output()`; optionally wrap with **`ControlValueAccessor`** so it works as a real form control (`formControlName`/`ngModel`). CVA is a strong design-system signal if time allows — otherwise leave a comment noting the intended integration path.
- Date utility: **TBD**. Because the design needs TZ + time-of-day → date-fns (+ date-fns-tz) or Luxon (strong TZ). Day.js is fine only if TZ is scoped out.

## Open / next up

- Architecture not yet designed: token layer; signal **state shape** (draft vs committed range, hovered date, active preset, computed summary string); **preset → range mapping**; popover **positioning + click-outside/focus** handling; **a11y** (keyboard nav, ARIA).
- Pick the date library.
- Decide whether to implement CVA within the time box.

## Suggested grill-me topics for the doc session

- Signals: `computed` vs `effect` (when each runs, glitch-free behavior), `linkedSignal`, untracked reads.
- Zoneless change detection: what triggers CD now, OnPush implications, common foot-guns.
- New control flow and `@for` tracking semantics.
- `ControlValueAccessor`: `writeValue`, `registerOnChange`/`registerOnTouched`, `NG_VALUE_ACCESSOR` provider wiring.
- Signal APIs: `input()`, `output()`, `model()` vs the legacy decorators.
- Modern CSS: `@layer`, custom properties as tokens, `color-mix()`, `:has()`, native nesting (container queries probably unneeded but on-brand for the role).
- Date/timezone handling in the chosen library.
