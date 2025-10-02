# MVP Testing Quickstart

_Last updated: 2025-10-02_

This guide is the hands-on companion to `TESTING_OVERVIEW.md`. It explains how to exercise the minimum viable product (MVP) test suites locally, what to expect from each command, and how to triage failures quickly.

## Goals

- Provide a single place to copy/paste the core test commands
- Clarify when to run unit vs. integration vs. combined sweeps
- Outline environment prerequisites and common fixes
- Show how the local workflow maps to the continuous integration (CI) job

## Prerequisites

- Node.js **20.x** (or newer that satisfies `package.json` engines)
- npm **8+** with lockfile support for `npm ci`
- Optional (only for extended suites):
  - Playwright dependencies (`npx playwright install --with-deps`)
  - `tauri-driver` and Microsoft Edge WebDriver for desktop smoke tests

Before running any tests, install dependencies:

```bash
npm ci
```

> `npm install` also works, but `npm ci` is faster and matches the CI pipeline exactly.

## Core commands

| Purpose | Command | Runtime (local M2 MBP) | Notes |
|---------|---------|------------------------|-------|
| Unit sweep (jsdom + Konva) | `npm run test:mvp` | ~1.7s | 104 tests covering geometry, history, viewport, keyboard shortcuts, canvas stage events (clear + ctrl/meta toggle + RAF batching instrumentation), canvas tool manager behavior, and architecture compliance.
| Integration sweep | `npm run test:mvp:integration` | ~1.5s | Runs renderer registry, CanvasRenderer selection lifecycle, transformer controller events, and FigJam stage lifecycle against real Konva layers.
| Combined gate | `npm run test:mvp:all` | ~3.3s | Runs unit then integration suites sequentially. Mirrors the CI workflow.
| Full Vitest run w/ coverage reporter | `npm run test:ci` | ~6.5s | Includes non-MVP suites. Use before publishing large changes.
| Targeted file (verbose) | `npm test -- <path> --reporter=verbose` | varies | Handy during development; respects watch/--run options.

### When to run what

- **During feature development**: start with `npm run test:mvp` and rerun affected suites individually as you iterate.
- **Before committing**: run `npm run test:mvp:all` to ensure both layers stay green.
- **Before opening a PR**: pair `npm run test:mvp:all` with `npm run lint` and `npm run type-check`.
- **Before tagging or releasing**: add `npm run test:ci` to cover the extended suites and surface coverage output.

## Extended suites

| Suite | Command | Status |
|-------|---------|--------|
| Playwright visual baselines | `npm run test:e2e:update` (once) then `npm run test:e2e` | Snapshots require regeneration; currently opt-in/manual. |
| Desktop smoke (tauri-driver) | `npm run test:desktop` | Manual; ensure `tauri-driver --native-driver` hub and matching msedgedriver are running. |
| Performance budgets | `npm run test:performance-budgets` | Placeholder scaffold; thresholds still TBD. |

## Reading the output

- **Architecture compliance** logs a TOP IN-DEGREE table for awareness. This is informational; it does not fail the suite.
- **Renderer registry** logs mounting/unmounting messages from module factories. These come from the shared debug logger and indicate the disposer executed.
- Expect Vitest to use the jsdom environment. If you see attempts to load native `canvas`, double-check that aliases in `vitest.config.ts` haven’t been modified.

## Failure triage checklist

1. **Re-run with verbose reporter** for the failing file: `npm test -- <file> --reporter=verbose`.
2. **Check Konva selector assertions**. `findOne()` returns `undefined` in Konva 9; use `toBeFalsy()` or `== null` to allow both `null` and `undefined`.
3. **Confirm setup files loaded**. The command output should mention both `setupTests.ts` and `setupCanvas.ts`. Missing entries often mean Vitest was run from a different config.
4. **Clear jsdom side-effects**. If state bleeds between tests, ensure you call `cleanup()` from React Testing Library or reset stores between assertions.
5. **For integration flakes**, confirm your environment has a `document` (CLI runs should) and that no code path imports `konva-node`.

## Mapping to CI

The `ci.yml` GitHub Actions workflow runs:

1. `npm ci`
2. `npm run lint`
3. `npm run type-check`
4. `npm run test:mvp:all`

Keeping these commands green locally guarantees the CI job passes. If you need to replicate CI exactly, use `npm ci` and run the commands in that order on a clean tree.

## Tips & tricks

- Use `npm run test:mvp -- --watch` for a watch mode restricted to MVP unit suites.
- Append `--run` to Vitest invocations when you only want a single pass (no watch).
- Combine with `DEBUG=canvas:*` to enable verbose logging from the shared canvas logger during tests.
- For faster local cycles, run `npm run test:mvp -- --threads=false` if you suspect concurrency is hiding console output.

## Related documents

- [`docs/testing/TESTING_OVERVIEW.md`](./TESTING_OVERVIEW.md) – Architecture, harness details, and roadmap
- [`docs/testing/test-inventory.md`](./test-inventory.md) – Current coverage snapshot and outstanding gaps
- [`docs/canvas-hardening-plan.md`](../canvas-hardening-plan.md) – Project-wide hardening milestones and test-related goals
