# Sticky Note Module Refactoring Plan

**File**: `src/features/canvas/modules/sticky-note/StickyNoteModule.ts`  
**Current Size**: 929 lines  
**Target Size**: ~250 lines  
**Reduction**: 73%  
**Priority**: HIGH  
**Estimated Time**: 3-4 days

---

## 📊 Current Structure Analysis

### Line-by-Line Breakdown

```
Lines 1-50:    Imports and module setup
Lines 51-150:  Core rendering logic - 99 lines
Lines 151-300: Resize handling - 149 lines
Lines 301-500: Event handlers - 199 lines
Lines 501-700: Text editor integration - 199 lines
Lines 701-929: Utility methods and cleanup - 228 lines
```

### Key Issues
- ❌ 929 lines in single module
- ❌ Rendering, resize, events, and editing all mixed
- ❌ Hard to test individual sticky note features
- ❌ Poor code organization

---

## 🎯 Refactoring Strategy

### 🛡️ Safeguards & Constraints
- Document current sticky note schema (position, size, rotation, color, text, z-index) and assert invariants while subsystems shadow the legacy module.
- Capture reference fixtures for resize geometry, text editor overlay positions, and color changes to compare post-refactor behavior.
- Maintain undo/redo event ordering across drag, resize, color, and text edits by reusing existing history actions.
- Keep overlay positioning logic aligned with Konva guidance: recompute using `absolutePosition` + stage bounds, applying rotation/scale transforms.
- Feature-flag the new module and log discrepancies between legacy and refactored outputs during rollout.

### 🧭 Phased Plan
1. **Phase 0 – Baseline capture**
   - Record Playwright sessions covering create, drag, resize, edit, color change, delete, undo/redo.
   - Save DOM overlay snapshots (text editor bounding boxes) and sticky geometry data for regression comparison.
2. **Phase 1 – Utility extraction**
   - Extract pure geometry/util helpers backing resize + editor positioning; add unit tests validating min/max constraints and matrix transforms.
3. **Phase 2 – `StickyResizeHandler`**
   - Move resize lifecycle logic; ensure snap/constraint math remains accurate under rotation/scale.
   - Tests simulate corner/edge drags and check undo integration + frame budget.
4. **Phase 3 – `StickyEventHandlers`**
   - Extract event wiring for click/double-click/drag/color/delete; inject store actions + selection context explicitly.
   - Integration tests cover keyboard shortcuts, multi-select drags, color palette updates, and delete flows.
5. **Phase 4 – `StickyTextEditor`**
   - Manage DOM overlay lifecycle; recalc position on drag, zoom, resize, scroll; ensure keyboard events scoped correctly.
   - Tests assert pixel alignment with sticky bounds (<1px tolerance) and overlay cleanup to avoid leaks.
6. **Phase 5 – Module composition**
   - Assemble subsystems inside lean `StickyNoteModule`; run in shadow mode, comparing geometry, overlay placement, and undo timelines.
7. **Phase 6 – Hardening**
   - Add optional debug UI (dev flag) showing sticky bounds, resize handles, overlay rectangle, and action logs.
   - Update docs + diagrams; remove legacy path post sign-off.

### 🧪 Validation Strategy
- **Unit tests**: geometry math, resize constraints, editor positioning, event handler routing.
- **Integration tests**: drag, resize, text edit, color change, delete, keyboard shortcuts, multi-select interactions, undo/redo sequences.
- **E2E (Playwright)**: compound operations (drag → resize → edit → color → undo/redo) and stress tests with 50+ notes.
- **Performance**: ensure ≥60fps during drag/resize, editor open latency <50 ms, memory stable after repeated edits.
- **Manual QA**: rapid gesture combos, touch input, zoom extremes, clipboard workflows if supported.

### ✅ Exit Criteria
- Shadow comparison reveals zero deltas in geometry, overlay alignment, color state, or undo history.
- Automated suites (type, lint, Vitest, Playwright) pass with ≥80% coverage for new subsystems.
- Performance metrics meet targets (60fps interactions, overlay latency, memory stability).
- Debug overlay verifies consistent state transitions; remove or gate behind dev flag post-approval.

## 📋 Validation Checklist

- [ ] Sticky creation works with correct defaults
- [ ] Corner and edge resize behave within min/max constraints
- [ ] Dragging single/multi sticky notes preserves alignment and history
- [ ] Double-click enters text editing with overlay aligned (zoom/rotation aware)
- [ ] Text edits commit/cancel correctly (Enter/Esc) and propagate to store
- [ ] Overlay repositions after drag, resize, zoom, and viewport scroll
- [ ] Color picker updates visuals + history entries
- [ ] Delete + undo/redo flows restore prior state
- [ ] Keyboard shortcuts scoped correctly between canvas and editor
- [ ] ≥60fps during drag/resize (profiling evidence)
- [ ] Editor open latency <50 ms
- [ ] Memory steady after 200 edit cycles
- [ ] `npm run type-check`
- [ ] `npm run lint`
- [ ] Vitest suites (resize, events, editor)
- [ ] Playwright sticky note scenarios
- [ ] Docs + debug tooling updated

## 🎯 Success Metrics

- Sticky module reduced to orchestration (~250 lines) with dedicated resize, events, and editor subsystems.
- Zero regressions in positioning, keyboard shortcuts, undo history, or overlay accuracy.
- Performance and memory characteristics match or improve upon baseline, even with 50+ concurrent sticky notes.
