# Standalone components on Angular 21

**Status:** accepted (2026-09-10). Deletes `app.module.ts` and the
`@angular/platform-browser-dynamic` dependency.

## Context

The app was Angular 19 with a single NgModule declaring all eleven components, bootstrapped via
`platformBrowserDynamic().bootstrapModule()`. This was a documented, consistent choice rather than
drift — the README, the onboarding doc and `angular.json`'s schematics all agreed on it.

Two things made it worth revisiting:

1. **Security.** `npm audit` reported 3 critical and 33 high advisories against the installed tree,
   including a template namespace bypass and a two-way binding sanitisation bypass — both XSS, on a
   site that is live to the public. The fixes are in Angular 21.
2. **The migration blocker was real.** `@angular/platform-browser-dynamic` is not published for
   Angular 21; it caps at 20.0.7. The dependency was load-bearing, not vestigial, so the NgModule
   bootstrap was the thing standing between this app and a supported Angular.

## Decision

Migrate 19 → 20 → 21 with the CLI's own migrations at each hop, then run the standalone,
control-flow and `inject()` schematics.

- `main.ts` bootstraps through `bootstrapApplication(AppComponent, { providers: [...] })`.
- Each component declares its own `imports`; the shell imports the eight its template uses.
- Every component is `OnPush` — previously four of eleven — and `eslint.config.js` enforces it.
  With one shared rAF driving all animation, a default-strategy component is re-checked on every
  event it never needs.
- Constructor injection became `inject()` throughout.

## Consequences

- `npm audit` reports zero critical and zero high; the seven that remain are moderate and confined
  to build-time transitive dependencies.
- Initial transfer fell from 95.7 kB to 91.5 kB, mostly from dropping the NgModule metadata.
- The last four templates moved off `*ngIf` / `*ngFor`, so the codebase no longer mixes the two
  control-flow idioms.
- **Two pieces of state had to become signals for OnPush to be correct**, and this is the part to
  remember when adding a component: `ContactComponent`'s `copied` and `copyStatus` change after an
  `await` and again from a `setTimeout`, and `SiteNavComponent`'s `menuOpen` flips from a
  document-level Escape handler. None of those is an event on the component's own template, so a
  plain field would have gone stale on screen. A signal read in a template marks that view dirty
  itself, which is what makes them safe. **State that changes outside your own template's events
  must be a signal.**
- Four specs constructed their subject with `new Service(zone)` and had to move to the injector.
  They use TestBed's **real** `NgZone`: overriding that provider replaces the zone the framework
  itself runs on, which broke twenty-four tests until the stub was dropped.
- Karma now runs headless by default (`karma.conf.js`), so `npm test` works in CI and on a machine
  without Chrome installed.
