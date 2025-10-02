# Canvas Performance & Memory Audit

_Last updated: 2025-10-02_

## Goals

- Hold 60fps interactions for pan, zoom, drag, and marquee selection on project-sized boards.
- Ensure Konva layer batching prevents unnecessary `batchDraw` bursts.
- Detect and eliminate retained DOM/Konva nodes after teardown.
- Provide repeatable profiling notes for future regressions.

## Profiling Playbook

1. **Baseline Environment**
   - Browser: Chrome 129 (stable) with the Performance + Memory panels.
   - Hardware: Document CPU/RAM of the test device.
   - Canvas build: `npm run dev` (Vite) or `npm run build && npm run preview` for release profile.

2. **Scenarios to Measure**
   - **Pan & Zoom**: large board (100+ nodes), record frame timeline, capture RAF callbacks.
   - **Selection & Transformer**: multi-select (10 nodes) and resize, inspect Konva layer invalidations.
   - **Tool Usage**: sticky + connector creation burst (10 each) to watch memory/object churn.
   - **Teardown**: navigate away/unmount canvas, ensure layers and requestAnimationFrame handlers are freed.

3. **Metrics & Targets**
   - Frame budget: ≤ 16ms avg during interaction, spikes ≤ 28ms.
   - Memory: no sustained growth >10% after returning to idle; garbage collected within 5s.
   - RAF batching: `RafBatcher` flush count should not exceed interaction count by >1.

4. **Instrumentation Hooks**
   - Enable `DEBUG=canvas:*` to log layer draws and batch flushes.
   - Consider temporary counters in `RafBatcher` and `ToolManager` (remove post-audit).
   - Use Chrome Performance markers (`performance.mark`) when adding manual probes.

## Current Findings

| Date | Scenario | Result | Notes | Owner |
|------|----------|--------|-------|-------|
| 2025-10-02 | Pan & Zoom | Instrumented | Wheel zoom now routes DPR refresh through `RafBatcher.enqueueWrite`; `window.canvasRafBatcherStats` captures per-frame counts for DevTools inspection. | `perf@canvas` |
| 2025-10-02 | Selection & Transformer | Code review ✅ | Integration tests confirm attach/detach; capture trace to ensure transformer redraws don’t double-fire during marquee drags. | `perf@canvas` |
| 2025-10-02 | Tool Usage Burst | TODO | Validate `ToolManager` detach path clears drawing-tool subscriptions; add temporary counters. | `perf@canvas` |
| 2025-10-02 | Teardown | Manual review ✅ | `useCanvasStageLifecycle` destroys stage, overlay, `gridRenderer`, and clears window globals. Verify via Chrome Memory profiler. | `perf@canvas` |

## Observations & Quick Wins

- `RafBatcher` lives for the canvas lifecycle and is disposed during teardown. Remounting instantiates a fresh batcher, so re-entry is safe.
- `handleWheel` sync-updates grid DPR; batched redraws via `RafBatcher` reduces spikes during rapid zoom. Consider additional throttling for non-wheel DPR triggers.
- `updateOverlayTransform` writes to DOM style on every viewport change; scheduling through `requestAnimationFrame` avoids layout thrash under heavy pan.
- Drawing tools rely on `ToolManager` detach to remove RAF callbacks; instrumentation should confirm no residual listeners remain after switching back to Select.

## Follow-Up Tasks

- [ ] Capture baseline traces for each scenario and populate the table above.
- [x] Wire temporary counters into `RafBatcher` to log flush frequency via `window.canvasRafBatcherStats` (dev-only, strip before release).
- [ ] Add ToolManager detach counters to ensure drawing subscriptions clear correctly (dev-only instrumentation).
- [ ] Debounce grid DPR recalculation during scroll zoom using the existing `RafBatcher`.
- [ ] Audit Konva layer `batchDraw` cascades in marquee drag and transformer callbacks.
- [ ] Verify `useCanvasStageLifecycle` destroys layers and clears window globals under stress with Chrome Memory profiler.
- [ ] Document any fixes in `docs/performance/canvas.md` and link to relevant PRs.

## References

- `src/features/canvas/utils/performance/RafBatcher.ts`
- `src/features/canvas/components/figjam/hooks/useCanvasStageLifecycle.ts`
- `docs/canvas-hardening-plan.md#3-performance--memory-audit`
