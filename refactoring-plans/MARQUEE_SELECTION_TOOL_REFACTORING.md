# Marquee Selection Tool Refactoring Plan

**File**: `src/features/canvas/tools/selection/MarqueeSelectionTool.tsx`  
**Current Size**: 953 lines  
**Target Size**: ~200 lines  
**Reduction**: 79%  
**Priority**: CRITICAL  
**Estimated Time**: 3-4 days

---

## 📊 Current Structure Analysis

### Line-by-Line Breakdown

```
Lines 1-22:    Imports and dependencies
Lines 23-40:   Utility functions (18 lines)
Lines 41-953:  MarqueeSelectionTool component (912 lines)
  - State setup: ~50 lines
  - Event handlers: ~400 lines
    - Mouse down/move/up
    - Selection logic
    - Connector dragging
    - Transform coordination
  - Selection logic: ~150 lines
  - Connector drag logic: ~200 lines
  - Transform logic: ~150 lines
  - Render logic: ~100 lines
```

### Key Issues
- ❌ 912-line React component (massive)
- ❌ Multiple responsibilities mixed together
- ❌ Hard to test individual features
- ❌ Poor code reusability
- ❌ Difficult to understand control flow

---

## 🎯 Refactoring Strategy

### 🛡️ Safeguards & Assumptions
- Preserve the current selection/drag/connector contracts (payload shapes, undo events, Konva node references) with development-only assertions while the new hooks run in shadow mode.
- Share a `SelectionContext` so extracted hooks rely on stable refs for stage, selection store, and viewport transforms; prevents duplicated mutable state.
- Maintain the existing requestAnimationFrame batching cadence when updating marquee visuals, in line with Konva best practices and RAF scheduling research.
- Feature-flag the refactor so the legacy component can run alongside the new hooks during validation. Log divergences for quick triage.

### 🧭 Phased Plan
1. **Phase 0 – Baseline capture**
   - Record Playwright traces for all marquee scenarios (select, drag, connector, undo) and export selection state snapshots.
   - Document TypeScript interfaces for selection, drag, and connector payloads.
2. **Phase 1 – Utilities extraction**
   - Move pure math/helpers to `useMarqueeUtils`; add unit tests for bounds, hit detection, grid snapping.
   - Wire both legacy and hook implementations in development to compare results (console warnings on deltas).
3. **Phase 2 – Core hooks**
   - Sequentially extract `useMarqueeSelection`, `useMarqueeDrag`, and `useConnectorDrag`.
   - After each extraction run targeted Vitest suites and marquee Playwright scenarios; keep undo instrumentation to guarantee timeline integrity.
   - Ensure hooks obtain dependencies through explicit parameters (context, refs, store selectors) to avoid hidden globals.
4. **Phase 3 – Component composition**
   - Replace in-component logic with hook composition once metrics show zero diff in shadow mode.
   - Memoize derived values (`React.useMemo`, `useShallow`) to avoid render loops.
5. **Phase 4 – Hardening & cleanup**
   - Build debug overlay (dev flag) showing selection rect, connector hover state, RAF queue depth.
   - Remove legacy path, ensure cleanup of listeners and temp connectors to prevent memory leaks.

### 🧪 Validation Strategy
- **Unit tests**: utilities math, selection state transitions, drag offset calculations, connector hover detection.
- **Integration (Vitest + Playwright)**: multi-select, shift-add/remove, snap-to-grid, multi-element drag, connector re-routing, undo/redo stacks.
- **Performance**: Chrome profiler to confirm >60fps during drag/connector operations with 100 elements; monitor RAF batching logs.
- **Manual QA**: fast drag gestures, multi-pointer touch, selection while zooming, cross-window drag.
- **Observability**: temporary logging for hook state transitions and selection diffs, removed post sign-off.

### ✅ Exit Criteria
- All automated tests and lint/type checks pass.
- No delta between legacy and refactored outputs during shadow period.
- Performance metrics match or beat baseline (frame time < 16 ms, port detection < 5 ms).
- Undo/redo timeline identical to captured fixtures for drag and connector flows.

## 📋 Validation Checklist

### Functional
- [ ] Drag marquee selection (single & dense boards)
- [ ] Shift-add/remove selection
- [ ] Cmd/Ctrl click deselect
- [ ] Single-element drag with snapping
- [ ] Multi-element drag with snapping
- [ ] Connector drag start/update/end
- [ ] Port hover detection & feedback
- [ ] Connector reconnection
- [ ] Selection rectangle renders & clears correctly
- [ ] Undo/redo across selection + drag + connector operations

### Performance
- [ ] ≥60fps during selection
- [ ] ≥60fps during drag
- [ ] ≥60fps during connector drag
- [ ] RAF batching active (one batchDraw per frame)
- [ ] Port detection <5 ms
- [ ] Memory stable after 200 drag cycles

### Quality & Tooling
- [ ] `npm run type-check`
- [ ] `npm run lint`
- [ ] Vitest suites (utilities, selection, drag, connector)
- [ ] Playwright marquee scenarios
- [ ] Docs updated (architecture + hook usage)
- [ ] Debug overlay removed or behind dev flag

## 🎯 Success Metrics

**Before Refactoring:**
- Component: 953 lines (912-line component)
- All logic in single component
- Hard to test individual features
- Difficult to reuse logic

**After Refactoring:**
- Component: ~200 lines
- 5 focused, reusable hooks (~670 total lines)
- Each hook testable independently
- Clear separation of concerns
- Better code reusability

**Overall Impact:**
- 79% reduction in component size
- 5 reusable custom hooks
- Improved testability
- Better performance (memoization)

---

## 🚀 Next Steps After Completion

1. Apply hook pattern to FigJamCanvas.tsx
2. Reuse hooks in other selection tools
3. Document custom hook patterns
4. Update React architecture guide

---

**This refactoring establishes the custom hook pattern for complex React components and provides reusable selection/drag logic.**
