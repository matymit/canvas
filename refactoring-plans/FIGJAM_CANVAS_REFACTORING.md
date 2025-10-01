# FigJam Canvas Refactoring Plan

**File**: `src/app/FigJamCanvas.tsx`  
**Current Size**: 902 lines  
**Target Size**: ~150 lines  
**Reduction**: 83%  
**Priority**: HIGH  
**Estimated Time**: 3-4 days

---

## 📊 Current Structure Analysis

### Line-by-Line Breakdown

```
Lines 1-50:    Imports and setup
Lines 51-200:  Stage setup and initialization - 149 lines
Lines 201-400: Event handlers - 199 lines
Lines 401-600: Rendering coordination - 199 lines
Lines 601-800: Lifecycle management - 199 lines
Lines 801-902: Cleanup and utilities - 101 lines
```

### Key Issues
- ❌ 902-line React component
- ❌ Stage, events, and rendering all in one component
- ❌ Hard to test individual features
- ❌ Poor separation of concerns

---

## 🎯 Refactoring Strategy

### 🛡️ Safeguards & Constraints
- Preserve the four-layer pipeline (background → main → preview → overlay) exactly as today, including `listening` flags and z-order.
- Document stage/event/render contracts (refs, callback signatures, state selectors) and assert them during the shadow period.
- Maintain requestAnimationFrame batching for renderer updates; reuse a shared scheduler so render throughput stays at 60fps.
- Introduce feature flag to run legacy and refactored flows side-by-side, logging mismatched stage dimensions, events, or render queues.
- On unmount, ensure every listener and RAF ticket is cancelled to align with Konva memory/performance guidance.

### 🧭 Phased Plan
1. **Phase 0 – Baseline snapshots**
   - Capture DOM/stage metrics (dimensions, DPR, layer ordering) and Playwright runs for pan/zoom, selection, and multi-touch gestures.
   - Export undo/redo traces tied to canvas events for regression comparison.
2. **Phase 1 – `useCanvasStage` extraction**
   - Move stage/layer initialization, resize handling, and viewport setup to dedicated hook; inject dependencies via config object.
   - Unit-test resize listener management and DPR scaling.
3. **Phase 2 – `useCanvasEvents` extraction**
   - Consolidate pointer/keyboard handlers; accept stage refs + store actions explicitly.
   - Add integration tests simulating pointer/touch/wheel events to ensure propagation order and shortcut scoping remain intact.
4. **Phase 3 – `useCanvasRenderers` extraction**
   - Relocate render scheduling, ensure batching + diff logic stays intact; verify Konva `batchDraw` cadence with instrumentation.
   - Provide hooks for undo/redo convergence (render on history apply).
5. **Phase 4 – Component composition & cleanup**
   - Compose hooks inside a lean component; memoize heavy selectors (`useShallow`) to prevent re-render storms.
   - Run in shadow mode comparing legacy outputs for at least one sprint before switching flag.
6. **Phase 5 – Hardening & docs**
   - Remove legacy path, finalize documentation, and add developer tooling (optional stage debug overlay) behind a dev flag.

### 🧪 Validation Strategy
- **Unit tests**: stage sizing + resize math, event handler scoping, render scheduler queue.
- **Integration tests**: pan/zoom (mouse + trackpad), selection, drag, multi-touch gestures, keyboard shortcuts, undo/redo.
- **Performance profiling**: confirm ≥60fps with heavy boards (1000 elements) and stable memory usage.
- **Manual QA**: zoom extremes, rapid resize, window resize, switching tabs, stage recreation.
- **Telemetry**: temporary logging for layer batchDraw counts and event throughput during rollout.

### ✅ Exit Criteria
- Feature-flag shadow comparison shows no divergences across all captured scenarios.
- Type, lint, Vitest, and Playwright suites pass with ≥80% coverage on new hooks.
- Rendering profiler confirms one `batchDraw` per frame and no frame >16 ms under load.
- Undo/redo traces match baseline.

## 📋 Validation Checklist

- [ ] Stage initializes with correct size, DPR, and layers
- [ ] 4-layer pipeline preserved (ordering + listening flags)
- [ ] Pointer, wheel, keyboard events fire with correct ordering and scoping
- [ ] Pan/zoom gestures (mouse, trackpad, touch) behave identically
- [ ] Rendering covers all element types + overlays
- [ ] Undo/redo applies without visual drift
- [ ] ≥60fps during heavy interactions (profiling evidence)
- [ ] Memory steady after 30 minutes of canvas interaction
- [ ] `npm run type-check`
- [ ] `npm run lint`
- [ ] Vitest suites (stage, events, renderers)
- [ ] Playwright canvas scenarios
- [ ] Documentation + debug tooling updated

## 🎯 Success Metrics

- Component trimmed to ~150 lines with reusable hooks managing stage, events, and render pipeline.
- Render + event throughput equal to baseline; no regression in frame times or memory use.
- Refactor establishes modular hook architecture for other canvas surfaces.
