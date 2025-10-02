# Canvas Hardening & Launch Readiness Plan

_Last updated: 2025-10-02_

## 🎯 Goals

1. Deliver a production-ready Canvas experience (web + Tauri) with predictable performance and zero known security risks.
2. Establish maintainable documentation for developers, designers, and integrators.
3. Ensure tests, linting, and type safety protect the MVP feature set without excess cruft.
4. Finalize repository housekeeping so future contributors onboard quickly.

## 🗂️ Priority Roadmap

| Order | Workstream | Why it Matters | Success Criteria |
|-------|------------|----------------|------------------|
| 1 | **Type, Lint & Test Baseline** | Guarantees a healthy signal before deeper refactors | `npm run type-check`, `npm run lint`, and core tests pass without noise |
| 2 | **Test Suite Rebaseline** | Keeps only relevant coverage and closes critical gaps | Legacy specs archived, FigJam hook/unit tests added, CI green |
| 3 | **Performance & Memory Audit** | Protects 60fps goal and prevents Konva or DOM leaks | Profiling notes + fixes documented in `docs/performance/canvas.md` |
| 4 | **Repo Hygiene & Docs Consolidation** | Reduces mental overhead and duplication | Empty/unused files removed, docs merged, root tidy |
| 5 | **MCP Memory Graph Sync** | Keeps automated assistants aligned with reality | Every active plan mirrors MCP entries, no stale “open” items |
| 6 | **Design / UX Polish** | Presents a modern, cohesive UI | `docs/design/ux-playbook.md` drafted, token audit complete |
| 7 | **Integration Guidance** | Simplifies embedding Canvas in Tauri/Rust apps | `docs/development/canvas-tauri-integration.md` created |
| 8 | **Security Hardening** | Blocks launch-stopping vulnerabilities | Audits recorded, mitigations implemented, checklist added |
| 9 | **Final Production Sweep** | Confirms shippable quality | Release checklist ticked, builds/tag ready |

## ✅ Detailed Workstreams

### 1. Type, Lint & Test Baseline
- Run `npm run type-check`, `npm run lint`, `npm test` (Vitest), Playwright smoke as feasible.
- Track failures in `docs/hardening/triage.md` with owners.
- Fix high-signal issues first (type regressions, lint errors that mask real bugs).
- 2025-10-01: Refactored `ElementSynchronizer` to eliminate 17 `no-explicit-any` warnings (93 ➝ 76 remaining). Next targets: `useMarqueeDrag`, `ImageRenderer`, and selection managers.
- 2025-10-02: Cleared `no-explicit-any` from `useMarqueeDrag`, `ImageRenderer`, and `TransformStateManager` (76 ➝ 50). Identified connector/sticky-note modules as next highest offenders.
- 2025-10-03: Removed seven additional `no-explicit-any` warnings by fully typing `ConnectorSelectionManager` (50 ➝ 43). Upcoming focus: `ShapeTextSynchronizer`, sticky-notes, unified store.
- 2025-10-03: Typed `ShapeTextSynchronizer` to drop another six `no-explicit-any` warnings (43 ➝ 37). Sticky-note modules remain the largest cluster.
- 2025-10-03: Reworked `StickyRenderingEngine` viewport checks to stay within typed bounds (37 ➝ 31). Next up: `StickyTextEditor`, `MindmapSelectionManager`, and `useMarqueeSelection`.
- 2025-10-03: Hardened `StickyTextEditor` store access with concrete canvas types (31 ➝ 28). Remaining hotspots: `MindmapSelectionManager`, `useMarqueeSelection`, unified store helpers.
- 2025-10-03: Introduced typed mindmap selection helpers and removed remaining `SelectionModule` globals that used `any` (28 ➝ 22). Upcoming focus: `useMarqueeSelection`, `useCanvasShortcuts`, and unified store helpers.
- 2025-10-03: Refined `useMarqueeSelection` to rely on typed globals and store positions instead of `any` casts (22 ➝ 19). Next up: `useCanvasShortcuts` hotkey map and unified store helpers.
- 2025-10-03: Typed `useCanvasShortcuts` clipboard and paste flows, removing legacy `any` clones and adding safe IDs (19 ➝ 16). Remaining hotspots: unified store helpers and legacy table modules.
- 2025-10-03: Typed unified canvas store persistence + FigJam event/services hooks (16 ➝ 13). Next focus: table modules (`TableEditorManager`, `TableEventHandlers`) and hydrator console cleanup.
- 2025-10-03: Typed table renderer/editor callbacks using shared store typings and resize payloads (13 ➝ 6). Remaining hotspots: mindmap renderer/event glue and sticky event handlers.
- 2025-10-03: Eliminated residual `no-explicit-any` usage in mindmap renderer/event handlers and sticky note fallback selection (6 ➝ 0). Remaining lint noise stems from legacy `no-console` diagnostics.
- 2025-10-03: Began migrating marquee selection/drag tooling to the shared `debug` logger so `no-console` cleanup can proceed incrementally.
- 2025-10-03: Routed selection managers, image rendering modules, safe storage helpers, and marquee tooling through the shared logger to retire legacy `console.*` diagnostics.
- 2025-10-03: Routed Canvas error boundary crash reporting through the shared logger to finish console cleanup in runtime code paths.
- 2025-10-03: Removed the FigJam circle tool non-null assertion so full `npm run lint` runs without `no-non-null-assertion` warnings.
- 2025-10-03: Upgraded ESLint + @typescript-eslint tooling to support TypeScript 5.6 and re-ran `npm run lint` to confirm a clean baseline.

### 2. Test Suite Rebaseline
- Inventory existing tests (`src/test`, `e2e/`, Tauri). Note stale references.
- 2025-10-01: Captured current test coverage and stale specs in `docs/testing/test-inventory.md`; flagged broken Playwright scenarios and archived Tauri harnesses for follow-up.
- Archive non-MVP specs into `test-results/archive` with rationale.
- 2025-10-01: Archived legacy Playwright smoke (`e2e/canvas.spec.ts`) into `test-results/archive/playwright/` with README tracking rationale; left stub to point contributors at the preserved test.
- Add hook/unit tests for `useCanvasStageLifecycle`, `useCanvasEvents`, `useCanvasShortcuts`, etc.
- 2025-10-01: Added `useCanvasShortcuts` unit coverage (mindmap enter, select-all, undo delete flows) under `src/test/mvp/unit/canvas-shortcuts.test.ts`.
- 2025-10-01: Restored architecture compliance suite by loading real Konva with `vitest-canvas-mock`, naming renderer layers, and re-running `npm run test:mvp` to confirm green.
- 2025-10-01: Re-enabled MVP integration coverage (`renderer-registry`) and adapted assertions for Konva's nullish returns; `npm run test:mvp:integration` now passes.
- 2025-10-01: Verified combined sweep via `npm run test:mvp:all` to keep unit+integration gates green in one shot.
- 2025-10-01: Authored `docs/testing/mvp-test-guide.md` and added CI wiring (`.github/workflows/ci.yml`) to run lint, type-check, and `npm run test:mvp:all` on every push/PR.
- 2025-10-01: Added `ensureOverlayOnTop` + `setLayersPixelRatio` unit coverage in `rendering.test.ts` to lock in overlay ordering and HiDPI redraw behavior.
- 2025-10-02: Added `canvas-renderer` + `transformer-controller` integration coverage to validate selection attach/detach and transform lifecycle behavior.
- 2025-10-02: Authored FigJam canvas integration smoke test that renders the full component, verifies stage/layer setup plus overlay transform defaults, and asserts teardown removes Konva globals.
- 2025-10-02: Added `useCanvasEvents` unit coverage to lock background click clearing, node selection, and ctrl/meta toggle behavior to store mutations.
- 2025-10-02: Added `useCanvasTools` unit coverage to verify cursor swaps (pan/drawing/text) and ToolManager activation/detach flows.

### 3. Performance & Memory Audit
- Use Chrome DevTools + Konva inspector to profile draw, pan, selection, connector flows under load.
- Validate RAF batching, listener cleanup, and layer ordering in new hooks.
- Record findings and mitigations in `docs/performance/canvas.md`.
- Schedule follow-up fixes for any >16ms frame spikes or retained DOM nodes.
- 2025-10-02: Routed wheel zoom grid DPR updates through `RafBatcher` and added batching coverage in `canvas-events.test.ts` to guard against redundant redraws.
- 2025-10-02: Instrumented `RafBatcher` flush stats in dev builds and exposed `window.canvasRafBatcherStats` for profiling traces.

### 4. Repository Hygiene & Documentation Consolidation
- Script-assisted scan for empty/unused files & directories; archive or delete.
- Consolidate redundant docs (e.g., multiple READMEs) into canonical entries under `docs/`.
- Update root README and docs index to match the new structure.
- Ensure `refactoring-plans/` references remain accurate post-cleanup.
- 2025-10-02: Created `docs/legacy/` for archived planning notes, refreshed `docs/README.md` navigation, and fixed broken technical audit links in the root README and architecture overview.
- 2025-10-02: Inventoried root-level Markdown (`CANVAS _MASTER_BLUEPRINT.md`, `CLAUDE.md`, `DRAG_BUG_FIX.md`, `LARGE_FILE_REFACTORING_MASTER_PLAN.md`, `marquee_handoff.md`) and mapped target homes inside `docs/` to eliminate straggler files.
- 2025-10-02: Added a "Pending migrations" backlog to `docs/legacy/README.md` so contributors can track relocation status and update backlinks as each file moves from the repo root.
- 2025-10-02: Normalized the `docs/README.md` Change History heading to use the shared emoji set and avoid encoding artifacts in generated TOCs.
- 2025-10-02: Consolidated root `CLAUDE.md` guidance into `docs/guides/agents.md`, archived the legacy context in `docs/legacy/claude-agent-guide.md`, and deleted the root file.
- 2025-10-02: Relocated `CANVAS _MASTER_BLUEPRINT.md` into `docs/legacy/master-blueprint.md`, updated referencing docs, and trimmed the pending migration backlog accordingly.
- 2025-10-02: Moved `DRAG_BUG_FIX.md` into `docs/fixes/drag-bug-fix.md`, refreshed the docs index, and recorded the relocation in the legacy migration log.
- 2025-10-02: Archived `marquee_handoff.md` under `docs/legacy/marquee-handoff.md` with a summary pointing to the live marquee drag fix guidance.
- 2025-10-02: Shifted `LARGE_FILE_REFACTORING_MASTER_PLAN.md` into `refactoring-plans/` beside the other refactor roadmaps and updated references accordingly.
- 2025-10-02: Authored `refactoring-plans/README.md` and linked it from `docs/README.md` to centralize refactor roadmap navigation.

### 5. MCP Memory Graph Synchronization
- Export relevant nodes from the MCP memory graph.
- Cross-reference each entry with in-repo docs (plans, progress logs).
- Close, update, or delete outdated nodes; create new ones for fresh documentation.
- Summarize the sync outcome in `docs/hardening/memory-sync.md`.
- 2025-10-02: Staged the hardening documentation space at `docs/hardening/` and authored `memory-sync.md` to capture the review workflow and current node inventory.
- 2025-10-02: Documented MCP export/update procedures and a change-log template inside `docs/hardening/memory-sync.md` so future syncs remain auditable.
- 2025-10-02: Created `docs/hardening/exports/` (with `.gitkeep`) to store MCP graph dumps alongside recorded hashes.
- 2025-10-02: Pulled the live MCP Canvas namespace (`memory-read-graph`) and populated the node inventory/change log in `docs/hardening/memory-sync.md` with keep/update/create actions.

### 6. Design & UX Polish
- Audit Tailwind/PostCSS tokens, typography, spacing, and color usage.
- Identify legacy CSS, migrate to design primitives, ensure consistency.
- Draft `docs/design/ux-playbook.md` covering component standards, accessibility notes, and review process.
- 2025-10-02: Completed initial token audit (Tailwind vs. `figjam-theme.css`), documented gaps, and authored the first `docs/design/ux-playbook.md` with accessibility checklist and review process.
- 2025-10-02: Added design section to the docs hub referencing the UX playbook and created a backlog to formalize Tailwind token bridging and visual regression coverage.
- 2025-10-02: Shipped FigJam visual refresh—dotted grid, glass toolbar, sticky palette, and modal/drawer treatments—then synced the UX playbook with the new accent tokens.

### 7. Canvas Integration Guidance
- Document best practices for embedding Canvas in Tauri/Rust apps (window lifecycle, IPC, filesystem access).
- Provide troubleshooting tips, security considerations, and extension hooks.
- House this in `docs/development/canvas-tauri-integration.md` with code snippets.
- 2025-10-02: Authored `docs/development/canvas-tauri-integration.md`, covering dev workflow, IPC patterns, plugin scope, security guardrails, and packaging checklists; linked from the docs hub.

### 8. Security Hardening
- Run `npm audit --audit-level=moderate` and `cargo audit`.
- Perform static checks (ESLint security rules, optional Semgrep) and secret scans.
- Review Tauri configuration for unnecessary permissions or CSP gaps.
- Document findings + mitigations in `docs/security/canvas-security-review.md`.
- 2025-10-02: Logged security review baseline—`npm audit` clean, `cargo audit` highlights upstream GTK/GLib advisories, Semgrep pending MCP migration; opened tasks to scope plugin capabilities and monitor GTK4 upgrade path.
- 2025-10-02: Ran Semgrep cloud scan (26 non-blocking findings) and captured triage in `docs/security/canvas-security-review.md`, adding follow-ups for developer tooling hardening and legacy fixture hygiene.
- 2025-10-02: Hardened Semgrep-flagged scripts (`bundle-analyzer` + `check-forbidden-packages`) with glob/path sanitization and recorded the remediation in the security review log.
- 2025-10-02: Added SRI hashes to Konva CDN fixtures and replaced localhost anchors with static refs to clear remaining Semgrep HTML warnings.
- 2025-10-02: Normalized archived debug scripts to use constant-first-argument logging, silencing Semgrep format-string alerts.
- 2025-10-02: Scoped Tauri `main` capability to `shell:default` and app-data-only FS permissions, removing unrestricted read/write grants.
- 2025-10-02: Authored secret storage guidance (secure storage plugin, IPC scoping, rotation) to unblock upcoming authentication work.
- 2025-10-02: Published `docs/security/README.md` runbook centralizing recurring audits and response playbooks.
- 2025-10-02: Added `npm run security:baseline` + `npm run security:semgrep` helpers so audits are one command away.
- 2025-10-02: Created `docs/security/gtk4-watch.md` to track the upstream GTK4 migration and required follow-up steps.
- 2025-10-02: Completed the Workstream 9 production sweep with clean web/desktop builds and published the execution report in `docs/hardening/final-production-sweep.md`.

### 9. Final Production Sweep
- Ensure CHANGELOG, README, and blueprint docs reflect final state.
- Run `npm run build` and `tauri build` (if applicable) from a clean checkout.
- Sweep for TODO/FIXME or debug flags.
- Tag release candidate and draft release notes summarizing impacts and validation.
- Execution summary: `docs/hardening/final-production-sweep.md`.

## 🧭 Execution Notes
- Use a project board to track each workstream and subtask.
- Keep commits scoped per workstream for easy review.
- Prefer automation (scripts, CI jobs) to catch regressions early.
- Maintain an audit log for deleted files/tests with reasons.

## 📎 References
- `refactoring-plans/LARGE_FILE_REFACTORING_MASTER_PLAN.md`
- `refactoring-plans/FIGJAM_CANVAS_REFACTORING.md`
- `docs/performance/`
- `docs/design/`
- MCP memory graph (Canvas namespace)
