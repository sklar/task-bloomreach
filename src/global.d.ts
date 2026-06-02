/**
 * Makes the native `Temporal` global available to the type checker at compile
 * time. This is a `import type` — fully erased, so nothing is imported at
 * runtime and no polyfill ships in the browser bundle (the browser has native
 * Temporal; ADR-0001 / JUSTIFICATION §2, §12).
 *
 * The Node test runtime gets the `Temporal` runtime from the Vitest setup file
 * (`src/test-setup.ts`) instead — Node 22 has no native Temporal.
 */
import type {} from 'temporal-polyfill/global';
