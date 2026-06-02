# Date Range Picker

A design-system date range picker: a Trigger styled like an input opens a non-modal popover with a
two-month calendar, a presets sidebar, and a footer summary. Applying emits the selected Range to the
consumer (and logs it to the console). Built as a reusable, accessible Angular component — not a
one-off screen.

> [!IMPORTANT]
> **Browser support.** Targets Chrome/Edge 144+ and Firefox 147+, relying on the native
> [Temporal API](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal)
> and [CSS Anchor Positioning](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Anchor_positioning).
> Safari is intentionally out of scope —
> [JUSTIFICATION.md §2](JUSTIFICATION.md#2-native-temporal-api-temporalplaindate--no-date-library).

## Docs

- [Assignment](ASSIGNMENT.md)
- [Feature spec, contract, user stories](docs/PRD.md)
- [Domain glossary](CONTEXT.md)
- [Every decision and its rationale (§1–§12)](JUSTIFICATION.md)

## Stack

- [Angular 21](https://angular.dev/) — standalone components, signals, `OnPush`, zoneless
- [TypeScript 5.9](https://www.typescriptlang.org/) — strict
- [Temporal API](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal) — native, no date library ([temporal-polyfill](https://www.npmjs.com/package/temporal-polyfill) dev/test only)
- Vanilla CSS — [`@layer`](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer) cascade layers + two-tier custom-property design tokens
- [Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API) + [CSS Anchor Positioning](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Anchor_positioning) — no overlay library
- [Vitest](https://vitest.dev/) + jsdom + [axe-core](https://github.com/dequelabs/axe-core) — tests
- [ESLint](https://eslint.org/) ([angular-eslint](https://github.com/angular-eslint/angular-eslint)) + [Prettier](https://prettier.io/)
- [pnpm](https://pnpm.io/) — exact pinned versions

## Commands

| Command             | Action                                            |
| ------------------- | ------------------------------------------------- |
| `pnpm install`      | Install dependencies (exact pinned versions)      |
| `pnpm start`        | Dev server at `http://localhost:4200/`            |
| `pnpm build`        | Production build / typecheck → `./dist/`          |
| `pnpm watch`        | Rebuild on change (development config)            |
| `pnpm test`         | Vitest (jsdom); Temporal shim loaded in the setup |
| `pnpm lint`         | ESLint (Angular + TS)                             |
| `pnpm format:write` | Apply Prettier formatting                         |
| `pnpm format:check` | Check Prettier formatting                         |

## Project structure

```
.
├── docs/
│   ├── PRD.md                      # feature spec
│   └── adr/                        # architecture decision records
├── resources/
│   └── design.png                  # design reference
├── src/
│   ├── app/
│   │   ├── date-range-picker/      # the library component (bloom-date-range-picker)
│   │   │   ├── date-range-picker.ts        # smart root: state, open/close, apply/cancel, CVA, keyboard
│   │   │   ├── month-grid/                 # presentational calendar grid (rendered twice)
│   │   │   ├── presets-list/               # presentational presets radiogroup
│   │   │   ├── footer/                     # presentational summary + Cancel/Apply
│   │   │   ├── date-range.util.ts          # pure Temporal-only logic
│   │   │   ├── presets.ts                  # preset list + range mapping
│   │   │   └── date-range.types.ts         # DateRange, PresetId
│   │   ├── app.ts                  # demo shell — showcase page (app-root)
│   │   └── app.css                 # showcase page layout
│   ├── styles.css                  # @layer order + reset + primitive design tokens
│   ├── global.d.ts                 # compile-time Temporal types (erased)
│   └── test-setup.ts               # Vitest Temporal runtime shim
├── JUSTIFICATION.md                # decisions + rationale
├── CONTEXT.md                      # domain glossary
└── .browserslistrc                 # evergreen Chromium + Firefox
```

## With more time..

Roughly least to most important:

- Exotic keyboard shortcuts beyond the APG subset — e.g. Shift+PageUp/Down for year jumps.
- A Storybook catalog + `addon-a11y` visual AXE harness — doable on Angular 21 (Storybook 10.4), but needs a `pnpm.overrides` dep pin and runs a separate Webpack build; `addon-vitest` has no Angular 21 support yet, so it wouldn't share our Vitest setup.
- `setDisabledState` for the CVA — stubbed; the design has no disabled Trigger.
- `minDate`/`maxDate`, disabled days, selectable bounds — absent from the design, so omitted, not stubbed.
- A Playwright smoke test for the native `popover="auto"` path (top-layer, light-dismiss, focus-return) — jsdom can't exercise it.
- Focus containment / a modal `<dialog>` variant — the popover is deliberately non-modal today.
- **Properly style the component to actually match the design** — current CSS is structurally faithful and uses the locked palette, but it simply doesn't match the [design](resources/design.png) at all. There's also annoying layout shift when picking dates and many other issues to address.
