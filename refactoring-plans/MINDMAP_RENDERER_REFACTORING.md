# Mindmap Renderer Refactoring Plan

**File**: `src/features/canvas/modules/mindmap/MindmapRenderer.ts`  
**Current Size**: 925 lines  
**Target Size**: ~150 lines  
**Reduction**: 84%  
**Priority**: HIGH  
**Estimated Time**: 4-5 days

---

## 📊 Current Structure Analysis

### Line-by-Line Breakdown

```
Lines 1-50:    Imports and setup
Lines 51-250:  Node rendering logic - 199 lines
Lines 251-450: Edge rendering logic - 199 lines
Lines 451-650: Event handlers - 199 lines
Lines 651-850: Layout engine - 199 lines
Lines 851-925: Utility methods - 74 lines
```

### Key Issues
- ❌ 925 lines in single renderer
- ❌ Node/edge rendering, events, layout all mixed
- ❌ Hard to test individual mindmap features
- ❌ Poor performance with large mindmaps

---

## 🎯 Refactoring Strategy

### 🛡️ Safeguards & Constraints
- Freeze existing node/edge/layout contracts, including geometry formats, animation timings, and history events; assert during shadow operation.
- Capture baseline layout snapshots (JSON + screenshots) for shallow, deep, and wide mindmaps to validate layout engine fidelity.
- Maintain single requestAnimationFrame scheduler for node/edge redraws and layout transitions to keep 60fps; log batchDraw counts per Konva guidance.
- Ensure expand/collapse, auto-layout, and connector interactions continue to fire undoable actions in the same order as today.
- Run legacy and refactored implementations side-by-side behind a flag, logging node positions, edge control points, and animation durations when mismatches appear.

### 🧭 Phased Plan
1. **Phase 0 – Baseline capture**
   - Export mindmap fixtures (varied depth/branching) including node/edge geometry, expand states, and layout timings.
   - Record Playwright sessions for drag, expand/collapse, auto-layout, and undo/redo flows.
2. **Phase 1 – Rendering subsystems**
   - Extract `MindmapNodeRenderer` and `MindmapEdgeRenderer`, keeping Konva node reuse/caching intact.
   - Unit-test styling, hit regions, and curved path math using captured fixtures.
3. **Phase 2 – Interaction handlers**
   - Move pointer/keyboard events into `MindmapEventHandlers`; inject node/edge renderers + selection/history APIs.
   - Integration tests confirm drag, expand/collapse, connector creation, and keyboard shortcuts (delete, duplicate, navigate) behave identically.
4. **Phase 3 – Layout engine**
   - Extract layout computation & animation to `MindmapLayoutEngine`; ensure deterministic outputs for same data.
   - Provide throttled/RAF-scheduled layout updates to avoid event storms; tests compare node positions within <1px tolerance and animation durations within ±10%.
5. **Phase 4 – Renderer orchestration**
   - Compose subsystems in trimmed `MindmapRenderer`; manage lifecycle, dependency injection, and render scheduling.
   - Run in shadow mode, comparing node/edge geometry + animation metrics to baseline fixtures.
6. **Phase 5 – Hardening**
   - Add debugging overlay (dev flag) showing layout bounding boxes and active animations.
   - Expand docs describing subsystem responsibilities & extension points.

### 🧪 Validation Strategy
- **Unit tests**: node styling updates, edge bezier math, layout calculations, animation easing curves.
- **Integration tests**: expand/collapse cascades, drag interactions, connector editing, auto-layout triggers, undo/redo spanning layout + render changes.
- **Performance**: profile with 100+ nodes to ensure ≥60fps, layout recompute <100 ms, animations smooth with no dropped frames.
- **Manual QA**: stress test with rapid expand/collapse, cross-branch drags, deep hierarchy layout adjustments, viewport transforms.
- **Telemetry**: temporary logs for layout duration, animation queue depth, and render batch counts; remove post sign-off.

### ✅ Exit Criteria
- Shadow comparison shows node positions, edge paths, and animation durations match baseline within tolerance.
- All automated suites (type, lint, Vitest, Playwright) pass with ≥80% coverage on new modules.
- Performance metrics meet targets (60fps, layout <100 ms, memory steady over 15 min session).
- Undo/redo timelines unchanged across interaction scenarios.

## 📋 Validation Checklist

- [ ] Node rendering matches baseline (colors, icons, text, badges)
- [ ] Edge rendering preserves curvature, arrows, and hit areas
- [ ] Auto-layout positions nodes within tolerance & avoids overlaps
- [ ] Expand/collapse animations maintain timing + easing
- [ ] Drag repositioning updates layout + edges live
- [ ] Edge click/selection/connector interactions work
- [ ] Undo/redo across layout + interaction operations
- [ ] ≥60fps with 100+ nodes (profiling evidence)
- [ ] Layout recompute <100 ms for large maps
- [ ] Memory steady during 15-minute stress session
- [ ] `npm run type-check`
- [ ] `npm run lint`
- [ ] Vitest suites (node, edge, events, layout)
- [ ] Playwright mindmap scenarios
- [ ] Docs + debug tooling updated

## 🎯 Success Metrics

- Core renderer reduced to orchestration (~150 lines) coordinating four focused subsystems.
- No regressions in geometry accuracy, animation quality, or performance under heavy loads.
- Refactored architecture enables reuse of node/edge/layout subsystems across other graph features.
