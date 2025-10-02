# Canvas Test Suite Inventory

_Last updated: 2025-10-02_

This inventory captures the current automated test coverage across the repository. It identifies active suites, archived or flaky specs, and known stale references that require follow-up during the hardening phase.

## Snapshot

| Area | Location | Status | Notes |
|------|----------|--------|-------|
| Unit (MVP) | `src/test/mvp/unit/*.test.ts` | ✅ Active | Cover geometry helpers, history, canvas events (background clear + ctrl/meta toggles), canvas tool activation/cursor behavior, rendering, spatial math, viewport store, and keyboard shortcut hooks. No skipped cases; relies on Vitest DOM environment. |
| Integration (MVP) | `src/test/mvp/integration/{renderer-registry,canvas-renderer,transformer-controller,figjam-canvas}.test.tsx` | ✅ Active | Covers renderer registry wiring, `CanvasRenderer` selection lifecycle, transformer controller redraw behavior, and FigJam stage lifecycle (overlay/cleanup) using real Konva layers. |
| E2E (MVP) | `src/test/mvp/e2e/**/*.test.ts` | ⚠️ Mixed | Playwright specs expect current regressions (for example `drag-events.test.ts` documents broken sticky selection). Snapshots (`*.test.ts-snapshots/`) out of date with latest UI. |
| Playwright smoke | `e2e/canvas.spec.ts` | ⚠️ Stale | Targets `http://localhost:1421/` and legacy DOM selectors (`div.transformer`). Requires refresh to use current data-test IDs and to avoid hard-coded dev port. |
| Performance harness | `src/test/performance-budgets.performance.test.ts` | 💤 Dormant | Vitest performance budget placeholder; no assertions beyond scaffold. |
| Archived specs | `src/test/archive/**/*` | 🗃️ Archived | Legacy persistence, transformer debug, Tauri harness, node pooling tests kept for reference. Many still `console.log` directly and depend on deprecated store APIs. |
| Tauri harness | `src/test/archive/tauri*.test.ts` | 🗃️ Archived | Written against deprecated IPC wrappers and mocked `@tauri-apps/api`. Need rewrite once Tauri integration guidance solidified. |
| Desktop parity smoke | `src/test/archive/desktop-parity.test.ts` | 🗃️ Archived | Placeholder for selenium-based parity run; never wired into CI. |
| Performance setup utilities | `src/test/performance-setup.ts` | ✅ Utility | Provides shared helpers for future performance suites. |
| Test configuration | `src/test/setupCanvas.ts`, `src/test/setupTests.ts` | ✅ Active | Global Vitest setup (JSDOM, Konva mocks). |

## Notable Gaps & Follow-Ups

1. **Broken MVP Playwright specs** – `drag-events.test.ts` intentionally asserts the transformer remains hidden due to a known regression. Once the selection regression is resolved, update the expectations and regenerate snapshots under `src/test/mvp/e2e/*-snapshots/`.
2. **Outdated smoke test (`e2e/canvas.spec.ts`)** – Relies on hard-coded port `1421` and DOM selectors (`div.transformer`) that predate the current React/Hook refactor. Needs refit to use the Vite dev server URL and data-test IDs.
3. **Archived Tauri tests** – `src/test/archive/tauri*.test.ts` mock early IPC utilities and no longer reflect the real Tauri bridge. They should either be rewritten against the new Tauri service layer or replaced with documentation-driven manual validation.
4. **Performance budget placeholder** – `src/test/performance-budgets.performance.test.ts` contains scaffolding without assertions. Determine whether to flesh out performance budgets or remove the spec to avoid false signal.
5. **Console logging in archived specs** – Several archived tests still emit `console.log` / `console.error` (for example `simple-persistence.test.ts`). They remain ignored by lint due to the archive path, but consider purging or modernising if we re-activate them.

## Next Steps

- Decide which MVP E2E specs are still relevant and retire or fix the ones that intentionally fail.
- Refresh Playwright smoke coverage with stable selectors and fixtures.
- Define scope for future Tauri automation (or formally document manual QA expectations) before reviving archived harness tests.
- Confirm whether the performance harness should graduate into CI or be archived alongside other placeholders.
