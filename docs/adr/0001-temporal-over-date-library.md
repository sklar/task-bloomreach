# Use the native Temporal API instead of a date library

We model dates with the native `Temporal.PlainDate` — a calendar date with no time and no timezone, which is exactly a date-_range_ endpoint — and use **no** date utility library and **no** polyfill. This deliberately **drops Safari support**: Temporal ships in Chrome/Edge 144, Firefox 139 and Node 26, but not Safari (Tech Preview only) as of mid-2026. That is acceptable because the assignment specifies **no browser-compatibility target** and scope is **desktop ≥1280px** — so the Safari gap is treated like narrow-screen layouts: out of scope, and closable in production with a ~16 KB drop-in polyfill (`temporal-polyfill`).

## Considered Options

- **Native Temporal** (chosen) — perfect semantic fit, zero runtime deps, standards-native (Stage 4), strong signal for the role.
- **date-fns** — works in every browser, but still native-`Date` underneath (we'd own the midnight/offset ambiguity) and a weaker signal.
- **Luxon** — heavier and class-based; unnecessary once timezone math is out of scope.
- **Native `Intl` + hand-rolled helpers** — bug-prone date math we'd maintain ourselves.

## Consequences

- The Firefox floor is **147** (for CSS Anchor Positioning, see JUSTIFICATION.md §6), not 139.
- TS 5.9 has no `Temporal` types and Node 22 has no `Temporal` runtime, so `temporal-polyfill` is a **devDependency** for types + the test runtime (browser still ships native, no polyfill). See JUSTIFICATION.md §12.

Full rationale: `JUSTIFICATION.md` §2 (and §6 for the related browser-target bump).
