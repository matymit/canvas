# Table Module Refactoring Plan

**File**: `src/features/canvas/modules/table/TableModule.ts`  
**Current Size**: 996 lines  
**Target Size**: ~250 lines  
**Reduction**: 75%  
**Priority**: CRITICAL  
**Estimated Time**: 4-5 days

---

## 📊 Current Structure Analysis

### Line-by-Line Breakdown

```
Lines 1-40:    Imports and type definitions
Lines 41-140:  TableModule class setup and initialization
Lines 141-180: Cell resolution logic (coordinate calculations) - 39 lines
Lines 181-450: Core rendering logic (MASSIVE) - 269 lines
  - Cell rendering
  - Header rendering
  - Border rendering
  - Resize handles
Lines 451-650: Event handlers (MASSIVE) - 199 lines
  - Click handlers
  - Drag handlers
  - Resize handlers
  - Context menu handlers
Lines 651-850: Utility methods and helpers - 199 lines
Lines 851-996: Cell editor integration - 145 lines
  - Editor positioning
  - Editor lifecycle
  - Text input handling
```

### Key Issues
- ❌ 996 lines in single module
- ❌ Rendering, events, and editing all mixed together
- ❌ Cell resolution logic buried in implementation
- ❌ Hard to test individual table features
- ❌ Poor separation of concerns

---

## 🎯 Refactoring Strategy

### 🛡️ Safeguards & Constraints
- Lock down current table schema (cell descriptors, selection state, editor payloads) and assert invariants while subsystems run in shadow mode.
- Record geometry fixtures for cell bounds, row/column metrics, and overlay positions to verify resolver/editor calculations post-extraction.
- Ensure every mutating action still routes through the undo dispatcher; replay captured timelines during validation.
- Maintain requestAnimationFrame batching for renders per Konva guidelines; all new modules must defer heavy drawing to shared scheduler.
- Feature-flag the refactor so legacy and new implementations can run in parallel for at least one sprint.

### 🧭 Phased Plan
1. **Phase 0 – Baseline capture**
   - Export table fixtures (various sizes, merged cells if present) plus Playwright traces for edits, resizes, and context menus.
   - Capture undo/redo logs for combined operations (drag → resize → edit).
2. **Phase 1 – Geometry & utilities**
   - Extract `TableCellResolver`; add deterministic tests comparing fixture outputs, including float tolerance for zoomed tables.
   - Introduce dev assertions ensuring resolver matches existing module during shadow period.
3. **Phase 2 – Interaction handlers**
   - Move pointer/keyboard/context events into `TableEventHandlers`; inject dependencies (resolver, selection store, history actions).
   - Integration tests simulate Konva events for click, drag, resize, context menu; verify pointer capture release and multi-select flows.
4. **Phase 3 – Editor subsystem**
   - Extract `TableEditorManager` controlling DOM overlay: position updates on scroll/zoom, keyboard handling, cleanup.
   - Tests confirm overlay aligns with cell bounds (pixel diff) and that shortcuts are correctly scoped between canvas/overlay.
5. **Phase 4 – Rendering engine**
   - Split drawing routines into `TableRenderingEngine`; maintain batching, caching, and reuse of Konva nodes.
   - Performance tests with 50×50 tables ensure frame time <16 ms.
6. **Phase 5 – Orchestration**
   - Compose subsystems inside trimmed `TableModule`; wire lifecycle management, dependency injection, and public API.
   - Run full shadow comparison, logging divergences in selection, editor state, or rendered geometry.
7. **Phase 6 – Imports & ecosystem**
   - Update downstream imports, regenerate barrel exports if needed, and adjust store selectors.
8. **Phase 7 – Hardening & docs**
   - Expand testing, finalize docs/diagrams, remove legacy path, keep optional diagnostic overlay behind dev flag (shows cell bounds, selection region, editor rect).

### 🧪 Validation Strategy
- **Unit tests**: resolver math, event routing, editor positioning, renderer batching.
- **Integration tests**: click/double-click, multi-cell drag selection, resize handles, context menu flows, keyboard shortcuts, undo/redo sequences.
- **E2E (Playwright)**: compound operations (drag → resize → edit → undo/redo), viewport transforms, stress with large tables.
- **Performance**: Chrome profiler to confirm ≥60fps during edit/resize, editor open latency <50 ms, memory stable after 500 edits.
- **Manual QA**: mixed input devices, rapid context menu usage, concurrent edits with multi-select, zoom extremes.

### ✅ Exit Criteria
- Legacy vs. refactored shadow comparison yields zero diffs across captured fixtures and scenarios.
- Type, lint, Vitest, and Playwright suites pass with ≥80% coverage for new modules.
- Undo/redo timelines identical to baseline logs.
- Performance benchmarks meet targets (frame times, latency, memory).

## 📋 Validation Checklist

### Functional
- [ ] Cell selection via click + drag
- [ ] Double-click opens editor with focus
- [ ] Editor input updates cell and Enter/Esc behave correctly
- [ ] Multi-select drag + shift/ctrl modifiers
- [ ] Row/column resize handles update geometry
- [ ] Table resize anchors behave (if present)
- [ ] Context menu opens with correct options
- [ ] Selection highlighting + headers remain aligned during scroll/zoom
- [ ] Undo/redo across drag/resize/edit sequences restores prior state

### Performance
- [ ] ≥60fps during cell edit/drag/resize
- [ ] Cell editor opens in <50 ms (measured)
- [ ] Renderer uses RAF batching (one batchDraw per frame)
- [ ] 50×50 table renders without frame drops
- [ ] Memory steady after 500 edit cycles

### Quality & Tooling
- [ ] `npm run type-check`
- [ ] `npm run lint`
- [ ] Vitest suites for resolver, handlers, editor, renderer
- [ ] Playwright table scenarios
- [ ] Docs updated (table architecture, subsystem responsibilities)
- [ ] Debug overlay flagged behind dev config

## 🎯 Success Metrics

- Core `TableModule` reduced to orchestration layer (~250 lines) with four focused subsystems.
- Improved testability: each subsystem independently unit-tested with ≥80% coverage.
- Runtime behavior identical to baseline with no regressions in performance or undo history.
- Pattern ready for reuse across other complex renderers.

## 🎯 Success Metrics

**Before Refactoring:**
- File size: 996 lines
- Single module handles all table logic
- Hard to test individual features
- Mixed concerns (rendering, events, editing)

**After Refactoring:**
- Core module: ~250 lines
- 4 focused subsystems (~770 total lines, better organized)
- Each subsystem testable independently
- Clear separation of concerns
- Better code navigation and IDE performance

**Overall Impact:**
- 75% reduction in main module size
- 5 focused, testable modules
- Improved maintainability
- Better performance (tree-shaking, code splitting)

---

## 🚀 Next Steps After Completion

1. Apply pattern to MarqueeSelectionTool.tsx
2. Use rendering engine pattern for other renderers
3. Document table architecture
4. Update CANVAS_MASTER_BLUEPRINT.md

---

**This refactoring makes TableModule.ts maintainable, testable, and performant while establishing the pattern for complex renderer refactorings.**
