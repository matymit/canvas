# Canvas Hardening & Launch Readiness Plan

_Last updated: 2025-10-03_

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

### 2. Test Suite Rebaseline
- Inventory existing tests (`src/test`, `e2e/`, Tauri). Note stale references.
- Archive non-MVP specs into `test-results/archive` with rationale.
- Add hook/unit tests for `useCanvasStageLifecycle`, `useCanvasEvents`, `useCanvasShortcuts`, etc.
- Update/author FigJam integration smoke test to exercise the new hook wiring.

### 3. Performance & Memory Audit
- Use Chrome DevTools + Konva inspector to profile draw, pan, selection, connector flows under load.
- Validate RAF batching, listener cleanup, and layer ordering in new hooks.
- Record findings and mitigations in `docs/performance/canvas.md`.
- Schedule follow-up fixes for any >16ms frame spikes or retained DOM nodes.

### 4. Repository Hygiene & Documentation Consolidation
- Script-assisted scan for empty/unused files & directories; archive or delete.
- Consolidate redundant docs (e.g., multiple READMEs) into canonical entries under `docs/`.
- Update root README and docs index to match the new structure.
- Ensure `refactoring-plans/` references remain accurate post-cleanup.

### 5. MCP Memory Graph Synchronization
- Export relevant nodes from the MCP memory graph.
- Cross-reference each entry with in-repo docs (plans, progress logs).
- Close, update, or delete outdated nodes; create new ones for fresh documentation.
- Summarize the sync outcome in `docs/hardening/memory-sync.md`.

### 6. Design & UX Polish
- Audit Tailwind/PostCSS tokens, typography, spacing, and color usage.
- Identify legacy CSS, migrate to design primitives, ensure consistency.
- Draft `docs/design/ux-playbook.md` covering component standards, accessibility notes, and review process.

### 7. Canvas Integration Guidance
- Document best practices for embedding Canvas in Tauri/Rust apps (window lifecycle, IPC, filesystem access).
- Provide troubleshooting tips, security considerations, and extension hooks.
- House this in `docs/development/canvas-tauri-integration.md` with code snippets.

### 8. Security Hardening
- Run `npm audit --audit-level=moderate` and `cargo audit`.
- Perform static checks (ESLint security rules, optional Semgrep) and secret scans.
- Review Tauri configuration for unnecessary permissions or CSP gaps.
- Document findings + mitigations in `docs/security/canvas-security-review.md`.

### 9. Final Production Sweep
- Ensure CHANGELOG, README, and blueprint docs reflect final state.
- Run `npm run build` and `tauri build` (if applicable) from a clean checkout.
- Sweep for TODO/FIXME or debug flags.
- Tag release candidate and draft release notes summarizing impacts and validation.

## 🧭 Execution Notes
- Use a project board to track each workstream and subtask.
- Keep commits scoped per workstream for easy review.
- Prefer automation (scripts, CI jobs) to catch regressions early.
- Maintain an audit log for deleted files/tests with reasons.

## 📎 References
- `LARGE_FILE_REFACTORING_MASTER_PLAN.md`
- `refactoring-plans/FIGJAM_CANVAS_REFACTORING.md`
- `docs/performance/`
- `docs/design/`
- MCP memory graph (Canvas namespace)
