# Code Standards

Write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

## TypeScript

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid `any`; use `unknown` when the type is uncertain

## Components

- Standalone components only — never NgModules
- Do NOT set `standalone: true` in decorators (it's the default in Angular v20+)
- Keep components small and focused on a single responsibility
- Set `changeDetection: ChangeDetectionStrategy.OnPush`
- Use `input()` and `output()` functions instead of decorators
- Do NOT use `@HostBinding`/`@HostListener` — put host bindings in the `host` object of the `@Component`/`@Directive` decorator
- Prefer inline templates for small components
- When using external templates/styles, use paths relative to the component TS file

## State

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals — use `update` or `set`

## Templates

- Keep templates simple; avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`), not `*ngIf`/`*ngFor`/`*ngSwitch`
- Use the async pipe to handle observables
- Do NOT use `ngClass` — use `class` bindings; do NOT use `ngStyle` — use `style` bindings
- Do not assume globals like `new Date()` are available

## Forms, Routing & Images

- Prefer Reactive forms over Template-driven ones
- Implement lazy loading for feature routes
- Use `NgOptimizedImage` for all static images (does not work for inline base64 images)

## Services

- Design services around a single responsibility
- Use `providedIn: 'root'` for singleton services
- Use the `inject()` function instead of constructor injection

## Accessibility

- MUST pass all AXE checks
- MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes
