/**
 * Vitest global setup. Installs the `Temporal` runtime shim so specs can use
 * `Temporal.PlainDate` etc. under Node 22, which has no native Temporal
 * (JUSTIFICATION §12). The browser ships native Temporal — this polyfill is
 * dev/test-only and never reaches the app bundle.
 */
import 'temporal-polyfill/global';
