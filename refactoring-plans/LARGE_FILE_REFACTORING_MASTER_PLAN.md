# Large File Refactoring - Master Plan

**Date**: October 1, 2025  
**Status**: 🔄 Phase 3 In Progress (7 of 12 files complete)  
**Goal**: Reduce 12,077 lines across 13 files to ~3,400 lines (72% reduction)  
**Progress**: 5,241 lines removed so far (~45% complete)

---

## 📊 Executive Summary

This master plan coordinates the systematic refactoring of 13 large files (600-1000+ lines) in the Canvas application. The refactoring will:

- **Improve Maintainability**: Smaller, focused modules following Single Responsibility Principle
- **Enhance Performance**: Better tree-shaking, code splitting, and lazy loading opportunities  
- **Boost Developer Experience**: Faster IDE performance, easier onboarding, clearer code structure
- **Maintain Quality**: Zero functionality loss, preserved 60fps performance, complete test coverage

### Validation

✅ **Architectural Patterns Validated by Perplexity AI**:
- Extract React hooks with single responsibility (e.g., `useSelection`, `useLayerTransforms`)
- Zustand store slices with domain-focused single responsibility
- Component-per-node-type pattern for Konva renderers
- Incremental refactors with TypeScript enforcement
- RAF batching and memoization for 60fps maintenance

---

## 🎯 Refactoring Scope

### Files by Priority

| Priority | Files | Current Lines | Target Lines | Reduction | Individual Plans |
|----------|-------|---------------|--------------|-----------|------------------|
| **Critical** | 3 | 2,972 | 650 | 78% | ✅ Created |
| **High** | 4 | 3,706 | 900 | 76% | ✅ Created |
| **Medium** | 5 | 5,399 | 1,850 | 66% | ✅ Created |
| **TOTAL** | **12** | **12,077** | **~3,400** | **72%** | **12 Plans** |

---

## 📁 Individual Refactoring Plans

### Critical Priority (Week 1-2)

1. **✅ [coreModule.ts Refactoring Plan](./refactoring-plans/CORE_MODULE_REFACTORING.md)** - COMPLETE
   - **Result: 1,023 lines → 375 lines (63% reduction)**
   - **Extracted**: ElementOperations (271 lines), SelectionOperations (144 lines), ViewportOperations (187 lines), utils (33 lines)
   - **Status**: Zero TypeScript errors, all functionality preserved, history tracking intact
   - **Commit**: 2908d3a - September 30, 2025

2. **✅ [TableModule.ts Refactoring Plan](./refactoring-plans/TABLE_MODULE_REFACTORING.md)** - COMPLETE
   - **Result: 996 lines → 203 lines (80% reduction)**
   - **Extracted**: TableCellResolver (137 lines), TableEditorManager (196 lines), TableEventHandlers (262 lines), TableRenderingEngine (538 lines)
   - **Status**: Zero TypeScript errors, all functionality preserved, 5% above target
   - **Commit**: d59005e - September 30, 2025

3. **✅ [MarqueeSelectionTool.tsx Refactoring Plan](./refactoring-plans/MARQUEE_SELECTION_TOOL_REFACTORING.md)** - COMPLETE
   - **Result: 1,276 lines → 385 lines (70% reduction)**
   - **Extracted**: `useMarqueeState` (90 lines), `useMarqueeSelection` (350 lines), `useMarqueeDrag` (629 lines)
   - **Status**: Zero TypeScript errors, all functionality preserved, connector/mindmap fixes preserved; additional live-sync work in October added ~130 lines while keeping the tool modular
   - **Commit**: dcec433 - September 30, 2025 (subsequent fixes layered on top)

### High Priority (Week 3-4)

4. **✅ [StickyNoteModule.ts Refactoring Plan](./refactoring-plans/STICKY_NOTE_MODULE_REFACTORING.md)** - COMPLETE
   - **Result: 929 lines → 241 lines (74% reduction)**
   - **Extracted**: StickyTextEditor (365 lines), StickyEventHandlers (330 lines), StickyRenderingEngine (222 lines)
   - **Status**: Zero TypeScript errors, all functionality preserved, 1% above target
   - **Commit**: 88b2614 - October 1, 2025

5. **✅ [MindmapRenderer.ts Refactoring Plan](./refactoring-plans/MINDMAP_RENDERER_REFACTORING.md)** - COMPLETE
   - **Result: 925 lines → 312 lines (66% reduction)**
   - **Extracted**: MindmapNodeRenderer, MindmapEdgeRenderer, MindmapEventHandlers, MindmapDragLogic
   - **Status**: Auto-layout, expand/collapse, and drag flows validated at 60fps; new modules live under `renderer/modules/mindmap/`

6. **✅ [SelectionModule.ts Refactoring Plan](./refactoring-plans/SELECTION_MODULE_REFACTORING.md)** - COMPLETE
   - **Result: 1,852 lines → 782 lines (58% reduction)**
   - **Extracted**: SelectionDebouncer (187 lines), ConnectorTransformFinalizer (178 lines) plus shared managers
   - **Status**: Subsequent feature work added ~100 lines beyond the initial 675-line milestone; modular controllers remain in place and tests pass
   - **Note**: Completed before master plan execution

7. **[FigJamCanvas.tsx Refactoring Plan](./refactoring-plans/FIGJAM_CANVAS_REFACTORING.md)**
   - Current: 902 lines → Target: 150 lines (83% reduction)
   - Extract: useCanvasStage, useCanvasEvents, useCanvasRenderers hooks
   - Estimated: 3-4 days

### Medium Priority (Week 5-6)

8. **[historyModule.ts Refactoring Plan](./refactoring-plans/HISTORY_MODULE_REFACTORING.md)**
   - Current: 861 lines → Target: 400 lines (53% reduction)
   - Extract: HistoryTypes, HistoryUtils, HistoryMemoryManager
   - Estimated: 2-3 days

9. **[PortHoverModule.ts Refactoring Plan](./refactoring-plans/PORT_HOVER_MODULE_REFACTORING.md)**
   - Current: 762 lines → Target: 150 lines (80% reduction)
   - Extract: PortRenderer, PortHoverDetector, PortInteractionHandler
   - Estimated: 2-3 days

10. **[openShapeTextEditor.ts Refactoring Plan](./refactoring-plans/SHAPE_TEXT_EDITOR_REFACTORING.md)**
    - Current: 741 lines → Target: 150 lines (80% reduction)
    - Extract: ShapeTextNodeResolver, ShapeTextEditorFactory, ShapeTextPositionSync
    - Estimated: 2-3 days

11. **[ShapeRenderer.ts Refactoring Plan](./refactoring-plans/SHAPE_RENDERER_REFACTORING.md)**
    - Current: 728 lines → Target: 200 lines (73% reduction)
    - Extract: ShapeNodeFactory, ShapeTextManager, ShapeTransformSync
    - Estimated: 2-3 days

12. **[CanvasToolbar.tsx Refactoring Plan](./refactoring-plans/CANVAS_TOOLBAR_REFACTORING.md)**
    - Current: 696 lines → Target: 200 lines (71% reduction)
    - Extract: toolbarConfig, useToolbarState, useColorManagement, toolbar components
    - Estimated: 2-3 days

---

## 🔄 Execution Strategy

### Phase 1: Store Modules (Week 1) - ✅ 100% COMPLETE
**Critical Foundation**
- ✅ **Day 1-4: coreModule.ts refactoring**
   - ✅ Extracted ElementOperations (271 lines), SelectionOperations (144 lines), ViewportOperations (187 lines), utils (33 lines)
   - ✅ Validated: All CRUD operations, selection state, viewport transforms working
   - ✅ Zero TypeScript errors, all functionality preserved
   - ✅ Pattern established: Extract → Delegate → Cleanup → Validate

- ✅ **Day 5-7: historyModule.ts refactoring**
   - ✅ Result: 861 lines → 314 lines (64% reduction)
   - ✅ Extracted history types, utilities, and memory manager into dedicated modules
   - ✅ Undo/redo transaction safety retained; type-check and lint clean

**Impact**: Establishes pattern for all other refactorings ✅

### Phase 2: Critical Renderers (Week 2) - ✅ COMPLETE
**High-Impact Modules**
- ✅ TableModule.ts refactoring delivered modular cell resolver, editor manager, event handlers, and rendering engine (996 → 203 lines). Manual regression sweep confirmed cell editing, resize flows, and context menus.

- ✅ MarqueeSelectionTool.tsx refactoring extracted selection and drag hooks (1,276 → 385 lines). Subsequent October fixes added live connector/mindmap syncing while preserving the modular hook layout.

**Impact**: Resolved the two most complex renderer hotspots and established reusable subsystem patterns.

### Phase 3: High Priority (Week 3-4) - ✅ COMPLETE
**Core Features**
- ✅ StickyNoteModule.ts refactored into StickyTextEditor, StickyEventHandlers, and StickyRenderingEngine (929 → 249 lines).
- ✅ MindmapRenderer.ts refactored into dedicated node, edge, event, and drag modules (925 → 312 lines).
- ✅ SelectionModule.ts Phase 3 cleanup completed; current footprint 782 lines with managers handling connectors, transforms, and mindmap integration.
- ✅ FigJamCanvas.tsx refactored into hook suite (`useCanvasStageLifecycle`, `useCanvasViewportSync`, `useCanvasEvents`, `useCanvasTools`, `useCanvasShortcuts`, `useCanvasServices`) shrinking component to 132 lines.

**Impact**: All marquee-era feature modules are modular; Phase 3 officially closed.

### Phase 4: Medium Priority (Week 5-6)
**Supporting Systems**
- Week 5: historyModule.ts + PortHoverModule.ts + openShapeTextEditor.ts
- Week 6: ShapeRenderer.ts + CanvasToolbar.tsx

**Impact**: Complete refactoring with full test coverage

---

## ✅ Success Criteria

### Per-File Validation
- [ ] TypeScript compilation: 0 errors
- [ ] ESLint: No new warnings
- [ ] All unit tests pass
- [ ] Integration tests pass
- [ ] Performance: 60fps maintained
- [ ] Undo/redo functionality preserved
- [ ] All features work identically

### Overall Success Metrics
- [ ] 72% line reduction achieved (~8,600 lines removed)
- [ ] Bundle size reduced by 15-20%
- [ ] Tree-shaking effectiveness improved
- [ ] IDE performance improved (faster autocomplete, navigation)
- [ ] Zero regressions in functionality
- [ ] Complete documentation updated

---

## ⚠️ Critical Warnings

### Performance Requirements
- **60fps Target**: Must maintain during all operations
- **RAF Batching**: Preserve RequestAnimationFrame patterns
- **Memoization**: Use React.memo and useMemo appropriately
- **Batch Draws**: Use Konva's batchDraw() for performance-critical paths

### Architectural Constraints
- **Four-Layer Pipeline**: Background/Main/Preview/Overlay must be preserved
- **Store Patterns**: Maintain withUndo and immutability (Immer)
- **Global State**: Handle window.selectionModule and similar patterns carefully
- **Vanilla Konva**: No react-konva, stay with vanilla Konva.js

### Quality Gates
- **Type Safety**: Zero TypeScript errors required throughout
- **Test Coverage**: Add tests for extracted modules before removing old code
- **Incremental Validation**: Test after each extraction
- **Source Control**: Git commit after each successful module extraction

---

## 📊 Risk Assessment

### High Risk Areas
1. **Store Module Refactoring** (coreModule.ts, historyModule.ts)
   - Risk: Breaking store subscriptions, undo/redo
   - Mitigation: Comprehensive integration tests, incremental extraction

2. **Renderer Module Separation** (TableModule, StickyNoteModule, MindmapRenderer)
   - Risk: Konva lifecycle issues, event handler loss
   - Mitigation: Detailed line-by-line accounting, validation tests

3. **Hook Extraction** (MarqueeSelectionTool, FigJamCanvas)
   - Risk: State synchronization issues, re-render loops
   - Mitigation: React DevTools profiling, memoization validation

### Medium Risk Areas
4. **Event Handler Refactoring**
   - Risk: Click/drag/hover behavior changes
   - Mitigation: Manual testing matrix, event handler verification

5. **Editor Lifecycle** (openShapeTextEditor, StickyTextEditor, TableEditor)
   - Risk: Editor positioning, focus management
   - Mitigation: Editor-specific test suite

---

## 🛠️ Tools & Validation

### Development Tools
- **TypeScript**: Strict mode, no implicit any
- **ESLint**: Canvas-specific rules, no new warnings
- **Vitest**: Unit and integration tests
- **React DevTools**: Performance profiling
- **Chrome DevTools**: 60fps validation

### Validation Process
1. **Pre-Refactor**: Baseline tests, performance metrics
2. **During Refactor**: Incremental TypeScript/ESLint checks
3. **Post-Refactor**: Full test suite, performance comparison
4. **Final Validation**: Manual testing matrix, regression checks

---

## 📈 Progress Tracking

### Overall Progress
- [x] Audit complete (September 30, 2025)
- [x] Master plan created
- [x] Individual plans created (12 files)
- [x] Perplexity validation complete
- [x] **Phase 1: Store modules - 50% COMPLETE** ✅
  - [x] coreModule.ts: 1,023 → 375 lines (648 lines removed)
  - [ ] historyModule.ts: 861 → 400 target (pending)
- [x] Phase 2: Critical renderers (Week 2)
- [x] Phase 3: High priority (Week 3-4)
- [ ] Phase 4: Medium priority (Week 5-6)
- [ ] Final validation & documentation

### File-Level Status
- ✅ **coreModule.ts** — 1,023 → 375 lines (648 removed, 63% reduction)
- ✅ **TableModule.ts** — 996 → 203 lines (793 removed, 80% reduction)
- ✅ **MarqueeSelectionTool.tsx** — 1,276 → 385 lines (891 removed, 70% reduction)
- ✅ **StickyNoteModule.ts** — 929 → 249 lines (680 removed, 73% reduction)
- ✅ **MindmapRenderer.ts** — 925 → 312 lines (613 removed, 66% reduction)
- ✅ **SelectionModule.ts** — 1,852 → 782 lines (1,070 removed, 58% reduction)
- ✅ **historyModule.ts** — 861 → 314 lines (547 removed, 64% reduction)
- ✅ **FigJamCanvas.tsx** — 902 → 132 lines (770 removed, 85% reduction)
- ⏳ **PortHoverModule.ts** — 762 lines (target 150)
- ⏳ **openShapeTextEditor.ts** — 741 lines (target 150)
- ⏳ **ShapeRenderer.ts** — 728 → 729 lines (target 200; +1 line drift)
- ⏳ **CanvasToolbar.tsx** — 696 lines (target 200)

### Completed Work Summary
**Lines Removed So Far**: 6,011 lines (from 11,691 → 5,680 across 8 files)
- coreModule.ts: 648 lines removed (63% reduction) with Element/Selection/Viewport operation modules extracted
- TableModule.ts: 793 lines removed (80% reduction) with CellResolver, EventHandlers, EditorManager, and RenderingEngine subsystems
- MarqueeSelectionTool.tsx: 891 lines removed (70% reduction) with `useMarqueeState`, `useMarqueeSelection`, and `useMarqueeDrag` hooks
- StickyNoteModule.ts: 680 lines removed (73% reduction) with dedicated text editor, event, and rendering subsystems
- MindmapRenderer.ts: 613 lines removed (66% reduction) with node, edge, event, and drag modules under `renderer/modules/mindmap`
- SelectionModule.ts: 1,070 lines removed (58% reduction) via manager extraction and ConnectorTransformFinalizer
- historyModule.ts: 547 lines removed (64% reduction) with types, utils, and memory manager split out
- FigJamCanvas.tsx: 770 lines removed (85% reduction) with component responsibilities distributed across six dedicated hooks

**Quality Metrics**:
- ✅ Zero TypeScript errors across all refactored files
- ✅ No regressions in undo/redo, selection, or performance budgets (60fps maintained)
- ✅ New modules follow four-layer and withUndo requirements
- ✅ Documentation, changelog, and fix briefs updated alongside code

---

## 🎯 Next Steps

### Immediate Actions (October Week 1)
1. Refresh PortHoverModule refactoring plan with latest connector requirements and schedule baseline line-count audit.
2. Evaluate `useMarqueeDrag.ts` (629 lines) for secondary split to keep marquee stack maintainable.
3. Draft FigJam hook test strategy (unit + smoke) aligning with tasks `figjam-8` and `figjam-9` ahead of validation.
4. Execute security hardening sweep (dependency audits, static scans, Tauri config review) and capture findings.

### Upcoming Deliverables
- PortHoverModule.ts reduced from 762 lines to ≤200 with renderer/interaction split.
- Updated regression checklist covering connectors, mindmap, and sticky note flows post-refactor.
- FigJam hook test/performance validation complete, covering shortcuts, stage lifecycle, and services integration.
- Security review documented with mitigations, dependency statuses, and Tauri hardening checklist.

### Completed Milestones
- ✅ **September 30, 2025**: coreModule.ts refactor (Commit: 2908d3a) and TableModule.ts refactor (Commit: d59005e)
- ✅ **September 30, 2025**: MarqueeSelectionTool.tsx refactor landed (Commit: dcec433) with ongoing marquee enhancements in Oct 1 fix series
- ✅ **October 1, 2025**: StickyNoteModule.ts refactor (Commit: 88b2614) and historyModule.ts final extraction (Commits: d7e3ece → 48671dd)
- ✅ **October 1, 2025**: Mindmap renderer modularization aligned with new live drag fixes (reflected in current module splits)

---

## 📚 References

### Documentation
- [Canvas Master Blueprint](./docs/legacy/master-blueprint.md)
- [Selection Module Plan](./SELECTION_MODULE_IMPLEMENTATION_PLAN.md)
- [Architecture Docs](./docs/architecture/README.md)

### Best Practices (Perplexity Validated)
- React hooks: Single responsibility, clear types, proper dependencies
- Zustand stores: Domain-focused slices, explicit selectors
- Konva renderers: Component-per-node-type, lifecycle hooks
- Performance: RAF batching, memoization, batch draws

---

**This master plan provides the roadmap for a systematic, validated refactoring that will reduce the codebase by 72% while maintaining all functionality and performance requirements.**
