# Selection Module Refactoring Plan (Phase 3 Completion)

**File**: `src/features/canvas/modules/selection/SelectionModule.ts`  
**Current Size**: 948 lines  
**Target Size**: ~649 lines (Phase 3 goal)  
**Reduction**: 31% (Phase 3)  
**Priority**: HIGH  
**Estimated Time**: 1-2 days (final cleanup)  
**Status**: 70% Complete

---

## 📊 Current Status

### Completion Status
- ✅ Phase 1: Extract useSelectionBounds hook - COMPLETE
- ✅ Phase 2: Extract useSelectionTransforms hook - COMPLETE
- ⏳ Phase 3: Final cleanup and optimization - IN PROGRESS

### Remaining Work (from SELECTION_MODULE_IMPLEMENTATION_PLAN.md)

```
Phase 3 Tasks (11 executable tasks):
1. Extract remaining small utilities
2. Optimize performance critical paths
3. Add comprehensive tests
4. Final documentation
```

---

## ✅ Executable Tasks (Phase 3 Final Cleanup)

```json
{
  "executable_tasks": [
    {
      "task_id": "selection-p3-1-extract-utils",
      "description": "Extract remaining utility functions to selectionUtils.ts",
      "target_files": [{"path": "src/features/canvas/modules/selection/SelectionModule.ts", "line_range": "Utility functions scattered throughout"}],
      "code_changes": [
        {
          "operation": "create",
          "file": "src/features/canvas/modules/selection/selectionUtils.ts",
          "content": "Extract utils:\n- isElementSelectable()\n- getSelectionCenter()\n- normalizeSelectionRect()\n- calculateSelectionArea()"
        }
      ],
      "validation_steps": ["npm run type-check", "npm test -- selectionUtils.test.ts"],
      "success_criteria": "Utils extracted, type-safe, all functions work",
      "dependencies": [],
      "rollback_procedure": "git checkout src/features/canvas/modules/selection/SelectionModule.ts && rm src/features/canvas/modules/selection/selectionUtils.ts"
    },
    {
      "task_id": "selection-p3-2-optimize-renders",
      "description": "Optimize re-render performance with React.memo and useMemo",
      "target_files": [{"path": "src/features/canvas/modules/selection/SelectionModule.ts", "line_range": "Performance critical sections"}],
      "code_changes": [
        {
          "operation": "insert",
          "content": "Add memoization:\n- React.memo for selection components\n- useMemo for expensive calculations\n- useCallback for event handlers"
        }
      ],
      "validation_steps": ["React DevTools profiling", "Verify no unnecessary re-renders"],
      "success_criteria": "Re-renders minimized, 60fps maintained",
      "dependencies": [],
      "rollback_procedure": "git checkout src/features/canvas/modules/selection/SelectionModule.ts"
    },
    {
      "task_id": "selection-p3-3-add-integration-tests",
      "description": "Add comprehensive integration tests",
      "target_files": [{"path": "src/features/canvas/modules/selection/__tests__/SelectionModule.integration.test.ts", "status": "create"}],
      "code_changes": [
        {
          "operation": "create",
          "file": "src/features/canvas/modules/selection/__tests__/SelectionModule.integration.test.ts",
          "content": "Integration tests:\n- Selection + bounds calculation\n- Selection + transforms\n- Multi-select + group operations\n- Undo/redo integration"
        }
      ],
      "validation_steps": ["npm test -- SelectionModule.integration.test.ts"],
      "success_criteria": "All integration tests pass, >85% coverage",
      "dependencies": [],
      "rollback_procedure": "rm src/features/canvas/modules/selection/__tests__/SelectionModule.integration.test.ts"
    },
    {
      "task_id": "selection-p3-4-refactor-event-handlers",
      "description": "Consolidate and optimize event handlers",
      "target_files": [{"path": "src/features/canvas/modules/selection/SelectionModule.ts", "line_range": "Event handler sections"}],
      "code_changes": [
        {
          "operation": "refactor",
          "content": "Consolidate event handlers:\n- Group related handlers\n- Remove duplicate logic\n- Optimize event propagation"
        }
      ],
      "validation_steps": ["npm run type-check", "npm test", "Manual event testing"],
      "success_criteria": "Event handlers optimized, no behavior changes",
      "dependencies": [],
      "rollback_procedure": "git checkout src/features/canvas/modules/selection/SelectionModule.ts"
    },
    {
      "task_id": "selection-p3-5-cleanup-comments",
      "description": "Clean up comments and improve code documentation",
      "target_files": [{"path": "src/features/canvas/modules/selection/SelectionModule.ts", "line_range": "1-948"}],
      "code_changes": [
        {
          "operation": "refactor",
          "content": "Documentation cleanup:\n- Remove outdated comments\n- Add JSDoc for public methods\n- Improve inline documentation"
        }
      ],
      "validation_steps": ["Code review", "Documentation validation"],
      "success_criteria": "Clear, concise documentation, no outdated comments",
      "dependencies": [],
      "rollback_procedure": "git checkout src/features/canvas/modules/selection/SelectionModule.ts"
    },
    {
      "task_id": "selection-p3-6-final-type-safety",
      "description": "Ensure complete type safety across selection module",
      "target_files": [{"path": "src/features/canvas/modules/selection/SelectionModule.ts", "line_range": "1-948"}],
      "code_changes": [
        {
          "operation": "refactor",
          "content": "Type safety improvements:\n- Remove any types\n- Add strict null checks\n- Improve interface definitions"
        }
      ],
      "validation_steps": ["npm run type-check -- --strict", "TypeScript strict mode validation"],
      "success_criteria": "Zero TypeScript errors in strict mode",
      "dependencies": [],
      "rollback_procedure": "git checkout src/features/canvas/modules/selection/SelectionModule.ts"
    },
    {
      "task_id": "selection-p3-7-performance-benchmarks",
      "description": "Create performance benchmarks for selection operations",
      "target_files": [{"path": "src/features/canvas/modules/selection/__tests__/SelectionModule.perf.test.ts", "status": "create"}],
      "code_changes": [
        {
          "operation": "create",
          "file": "src/features/canvas/modules/selection/__tests__/SelectionModule.perf.test.ts",
          "content": "Performance benchmarks:\n- Selection update <5ms\n- Bounds calculation <5ms\n- Transform application <10ms\n- 100+ element selection <50ms"
        }
      ],
      "validation_steps": ["npm run test:performance", "Verify all benchmarks pass"],
      "success_criteria": "All performance benchmarks met",
      "dependencies": [],
      "rollback_procedure": "rm src/features/canvas/modules/selection/__tests__/SelectionModule.perf.test.ts"
    },
    {
      "task_id": "selection-p3-8-update-documentation",
      "description": "Update selection module documentation",
      "target_files": [{"path": "docs/architecture/selection-module.md", "status": "update"}],
      "code_changes": [
        {
          "operation": "update",
          "file": "docs/architecture/selection-module.md",
          "content": "Document:\n- Refactored architecture\n- Extracted hooks (useSelectionBounds, useSelectionTransforms)\n- Performance optimizations\n- Usage examples"
        }
      ],
      "validation_steps": ["Documentation review", "Team approval"],
      "success_criteria": "Complete, accurate documentation",
      "dependencies": ["selection-p3-1-extract-utils", "selection-p3-2-optimize-renders"],
      "rollback_procedure": "git checkout docs/architecture/selection-module.md"
    },
    {
      "task_id": "selection-p3-9-final-validation",
      "description": "Complete final validation of selection module",
      "target_files": [{"path": "src/features/canvas/modules/selection/SelectionModule.ts", "validation": "final"}],
      "code_changes": [
        {
          "operation": "validate",
          "checklist": [
            "All tests pass (unit + integration + performance)",
            "TypeScript strict mode: 0 errors",
            "ESLint: 0 warnings",
            "Bundle size reduced",
            "60fps performance maintained",
            "Documentation complete"
          ]
        }
      ],
      "validation_steps": ["npm run validate:all", "Full QA testing"],
      "success_criteria": "All validation checks pass",
      "dependencies": ["selection-p3-1-extract-utils", "selection-p3-2-optimize-renders", "selection-p3-3-add-integration-tests", "selection-p3-4-refactor-event-handlers", "selection-p3-5-cleanup-comments", "selection-p3-6-final-type-safety", "selection-p3-7-performance-benchmarks", "selection-p3-8-update-documentation"],
      "rollback_procedure": "N/A (validation only)"
    },
    {
      "task_id": "selection-p3-10-commit-phase3",
      "description": "Commit Phase 3 completion",
      "target_files": [{"path": "SELECTION_MODULE_IMPLEMENTATION_PLAN.md", "status": "update"}],
      "code_changes": [
        {
          "operation": "update",
          "file": "SELECTION_MODULE_IMPLEMENTATION_PLAN.md",
          "content": "Mark Phase 3 complete:\n- Update status to 100%\n- Document final line count\n- Add completion notes"
        }
      ],
      "validation_steps": ["git add .", "git commit -m 'feat: Complete Selection Module Phase 3 refactoring'"],
      "success_criteria": "Phase 3 marked complete, changes committed",
      "dependencies": ["selection-p3-9-final-validation"],
      "rollback_procedure": "git reset HEAD~1"
    },
    {
      "task_id": "selection-p3-11-celebrate",
      "description": "Celebrate Phase 3 completion! 🎉",
      "target_files": [],
      "code_changes": [],
      "validation_steps": ["Team celebration", "Retrospective meeting"],
      "success_criteria": "Team morale high, lessons learned documented",
      "dependencies": ["selection-p3-10-commit-phase3"],
      "rollback_procedure": "N/A (celebration cannot be undone 😄)"
    }
  ],
  "execution_order": ["selection-p3-1-extract-utils", "selection-p3-2-optimize-renders", "selection-p3-3-add-integration-tests", "selection-p3-4-refactor-event-handlers", "selection-p3-5-cleanup-comments", "selection-p3-6-final-type-safety", "selection-p3-7-performance-benchmarks", "selection-p3-8-update-documentation", "selection-p3-9-final-validation", "selection-p3-10-commit-phase3", "selection-p3-11-celebrate"],
  "critical_warnings": ["⚠️ Phase 3 builds on Phase 1 & 2 - ensure they're complete", "⚠️ Performance benchmarks are critical - do not skip", "⚠️ Documentation must be updated before merge", "⚠️ Final validation must pass all checks"]
}
```

---

## 📋 Validation Checklist (Phase 3)

### Functional Tests
- [ ] All selection modes work (single, multi, marquee)
- [ ] Bounds calculation accurate
- [ ] Transforms apply correctly
- [ ] Undo/redo fully functional
- [ ] Event handlers responsive
- [ ] No regressions from Phase 1 & 2

### Performance Tests
- [ ] Selection update <5ms
- [ ] Bounds calculation <5ms
- [ ] Transform application <10ms
- [ ] 100+ element selection <50ms
- [ ] 60fps maintained
- [ ] No unnecessary re-renders

### Quality Tests
- [ ] TypeScript strict mode: 0 errors
- [ ] ESLint: 0 warnings
- [ ] Test coverage: >85%
- [ ] Bundle size reduced
- [ ] Documentation complete

---

## 🎯 Success Metrics (Phase 3)

**Phase 1 Result**: Extracted useSelectionBounds  
**Phase 2 Result**: Extracted useSelectionTransforms  
**Phase 3 Goal**: Final cleanup → 649 lines total  

**Overall Impact (All Phases)**:
- Original: 948 lines
- Phase 3 Target: 649 lines
- Reduction: 31%
- Extracted hooks: 2 reusable hooks
- Performance: Optimized, 60fps maintained
- Test coverage: >85%

---

## 🚀 Next Steps After Phase 3

1. ✅ Selection Module fully refactored (100% complete)
2. Apply learnings to FigJamCanvas.tsx
3. Document selection patterns in architecture guide
4. Consider additional performance optimizations

---

**Phase 3 completes the Selection Module refactoring, achieving the 649-line target with full functionality, performance, and test coverage.**
