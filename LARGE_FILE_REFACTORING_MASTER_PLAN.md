# Large File Refactoring - Master Plan

**Date**: September 30, 2025  
**Status**: Planning Phase  
**Goal**: Reduce 12,077 lines across 13 files to ~3,400 lines (72% reduction)

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

1. **[coreModule.ts Refactoring Plan](./refactoring-plans/CORE_MODULE_REFACTORING.md)**
   - Current: 1,023 lines → Target: 200 lines (80% reduction)
   - Extract: ElementOperations, SelectionOperations, ViewportOperations
   - Estimated: 3-4 days

2. **[TableModule.ts Refactoring Plan](./refactoring-plans/TABLE_MODULE_REFACTORING.md)**
   - Current: 996 lines → Target: 250 lines (75% reduction)
   - Extract: TableCellResolver, TableEventHandlers, TableEditorManager, TableRenderingEngine
   - Estimated: 4-5 days

3. **[MarqueeSelectionTool.tsx Refactoring Plan](./refactoring-plans/MARQUEE_SELECTION_TOOL_REFACTORING.md)**
   - Current: 953 lines → Target: 200 lines (79% reduction)
   - Extract: useMarqueeSelection, useMarqueeDrag, useConnectorDrag hooks
   - Estimated: 3-4 days

### High Priority (Week 3-4)

4. **[StickyNoteModule.ts Refactoring Plan](./refactoring-plans/STICKY_NOTE_MODULE_REFACTORING.md)**
   - Current: 929 lines → Target: 250 lines (73% reduction)
   - Extract: StickyResizeHandler, StickyEventHandlers, StickyTextEditor
   - Estimated: 3-4 days

5. **[MindmapRenderer.ts Refactoring Plan](./refactoring-plans/MINDMAP_RENDERER_REFACTORING.md)**
   - Current: 925 lines → Target: 150 lines (84% reduction)
   - Extract: MindmapNodeRenderer, MindmapEdgeRenderer, MindmapEventHandlers, MindmapLayoutEngine
   - Estimated: 4-5 days

6. **[SelectionModule.ts Refactoring Plan](./refactoring-plans/SELECTION_MODULE_REFACTORING.md)**
   - Current: 948 lines → Target: 649 lines (Phase 3 completion)
   - Status: 70% complete, see SELECTION_MODULE_IMPLEMENTATION_PLAN.md
   - Estimated: 1-2 days (final cleanup)

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

### Phase 1: Store Modules (Week 1)
**Critical Foundation**
- Day 1-4: coreModule.ts refactoring
  - Extract ElementOperations, SelectionOperations, ViewportOperations
  - Validate: All CRUD operations, selection state, viewport transforms
  - Test: Comprehensive integration tests

**Impact**: Establishes pattern for all other refactorings

### Phase 2: Critical Renderers (Week 2)
**High-Impact Modules**
- Day 5-9: TableModule.ts refactoring
  - Extract cell resolver, event handlers, editor, rendering engine
  - Validate: Cell editing, context menus, resize operations
  - Test: Table interactions, performance benchmarks

- Day 10-13: MarqueeSelectionTool.tsx refactoring
  - Extract selection/drag hooks
  - Validate: Multi-select, connector dragging, transform coordination
  - Test: Selection scenarios, drag operations

**Impact**: Resolves most complex rendering logic

### Phase 3: High Priority (Week 3-4)
**Core Features**
- Week 3: StickyNoteModule.ts + MindmapRenderer.ts
- Week 4: SelectionModule.ts (Phase 3 completion) + FigJamCanvas.tsx

**Impact**: All major features refactored and validated

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
- [ ] Phase 1: Store modules (Week 1)
- [ ] Phase 2: Critical renderers (Week 2)
- [ ] Phase 3: High priority (Week 3-4)
- [ ] Phase 4: Medium priority (Week 5-6)
- [ ] Final validation & documentation

### File-Level Status
- coreModule.ts: ⏳ Plan ready
- TableModule.ts: ⏳ Plan ready
- MarqueeSelectionTool.tsx: ⏳ Plan ready
- StickyNoteModule.ts: ⏳ Plan ready
- MindmapRenderer.ts: ⏳ Plan ready
- SelectionModule.ts: 🔄 70% complete (Phase 3 in progress)
- FigJamCanvas.tsx: ⏳ Plan ready
- historyModule.ts: ⏳ Plan ready
- PortHoverModule.ts: ⏳ Plan ready
- openShapeTextEditor.ts: ⏳ Plan ready
- ShapeRenderer.ts: ⏳ Plan ready
- CanvasToolbar.tsx: ⏳ Plan ready

---

## 🎯 Next Steps

### Immediate Actions (This Week)
1. ✅ Review master plan with team
2. ✅ Begin Phase 1: coreModule.ts refactoring
3. Create baseline performance metrics
4. Set up test infrastructure for extracted modules

### Week 1 Deliverables
- coreModule.ts refactored and validated
- ElementOperations, SelectionOperations, ViewportOperations modules created
- Integration tests passing
- Pattern established for remaining refactorings

---

## 📚 References

### Documentation
- [Canvas Master Blueprint](./CANVAS_MASTER_BLUEPRINT.md)
- [Selection Module Plan](./SELECTION_MODULE_IMPLEMENTATION_PLAN.md)
- [Architecture Docs](./docs/architecture/README.md)

### Best Practices (Perplexity Validated)
- React hooks: Single responsibility, clear types, proper dependencies
- Zustand stores: Domain-focused slices, explicit selectors
- Konva renderers: Component-per-node-type, lifecycle hooks
- Performance: RAF batching, memoization, batch draws

---

**This master plan provides the roadmap for a systematic, validated refactoring that will reduce the codebase by 72% while maintaining all functionality and performance requirements.**
