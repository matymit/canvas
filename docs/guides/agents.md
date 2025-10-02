# Agent Guidelines

Central playbook for AI and automation agents collaborating on the Canvas project.

## Pre-flight checklist
- Skim the root `README.md` for high-level goals and current constraints.
- Review `docs/architecture/README.md` to refresh the four-layer rendering contract.
- Check `docs/known-issues.md` and `docs/architecture/canvas-implementation-progress.md` for active hazards and in-flight refactors.
- Note any outstanding items in `docs/canvas-hardening-plan.md` related to your task area.

## Core commands

### Development
- Start web dev server: `npm run dev`
- Start Tauri desktop dev: `npm run tauri:dev`
- Run a specific test file: `npm test <relative-path>`
- Run the full test suite: `npm test`

### Build & release
- Build web bundle: `npm run build`
- Build production desktop app: `npm run tauri:build:production`
- Analyze bundle size: `npm run build:analyze`

### Quality gates
- Type check: `npm run type-check`
- Lint (strict, no warnings): `npm run lint`
- Auto-fix lint issues: `npm run lint:fix`
- Format source: `npm run format`
- Verify format: `npm run format:check`
- Performance budgets: `npm run test:performance-budgets`
- Bundle size smoke: `npm run test:bundle-size`
- Security audits: `npm run audit:security` and `npm run audit:licenses`

### Cleanup & maintenance
- Clean build artifacts: `npm run clean`
- Reset dependencies: `npm run clean:deps`

## Architecture guardrails
- **Rendering**: Use vanilla Konva APIs (`Konva.Stage`, `Konva.Layer`, `Konva.Node`). `react-konva` is blocked via `package.json` overrides.
- **Layers**: Maintain the four-layer pipeline (Background → Main → Preview → Overlay).
- **State**: All canvas mutations flow through the unified Zustand store and wrap user-facing actions in `withUndo()`.
- **Performance**: Batch stage updates via the RAF utilities, cache expensive nodes, and keep FPS ≥ 60.
- **Types**: TypeScript 5.6 strict mode, no `any`. Favor branded IDs, discriminated unions, and inference helpers already in `@types`.
- **Testing**: Add or update Vitest unit/integration coverage for new behaviors. For UI flows, consider Playwright smoke tests under `src/test/mvp/e2e/`.

## Performance budgets
- First Contentful Paint ≤ 1.5s
- Time to Interactive ≤ 3s
- Steady-state FPS ≥ 60
- Peak memory ≤ 500 MB
- Total bundle size ≤ 4 MB
- ≤ 4 canvas layers, ≤ 1000 nodes per layer

## Collaboration workflow

### Before starting work
- Confirm scope against the hardening plan or open issues.
- Inventory affected docs to keep references synchronized.
- Capture baseline metrics or failing tests relevant to your task.

### During implementation
- Fact-check existing code and dependency versions instead of assuming historical notes are current.
- Keep changes narrowly scoped and update tests alongside code.

### After finishing
- Update `docs/architecture/canvas-implementation-progress.md`, `docs/known-issues.md`, and `docs/CHANGELOG.md` when user-visible or architectural behavior changes.
- Note progress in `docs/canvas-hardening-plan.md` or the appropriate workstream log.
- Run `npm run type-check && npm run lint` and the most relevant test command(s) for your change.
- Summarize results, including any follow-up tasks, before handing off.

## Quick references
- Module layout lives under `src/features/canvas/` and mirrors the renderer/tools/store delineation from the architecture docs.
- Performance helper utilities reside in `@features/canvas/utils/performance/`.
- Shared types are exported from `types/` and `src/types/`. Favor these definitions over duplicating shapes locally.
