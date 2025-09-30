# Shape Text Editor Refactoring Plan

**File**: `src/features/canvas/modules/text-editor/openShapeTextEditor.ts`  
**Current Size**: 741 lines  
**Target Size**: ~150 lines  
**Reduction**: 80%  
**Priority**: MEDIUM  
**Estimated Time**: 2-3 days

---

## 📊 Current Structure Analysis

```
Lines 1-50:    Imports and setup
Lines 51-250:  Shape text node resolution - 199 lines
Lines 251-500: Editor factory and creation - 249 lines
Lines 501-741: Position synchronization - 240 lines
```

---

## 🎯 Refactoring Strategy

1. **ShapeTextNodeResolver** (`text-editor/ShapeTextNodeResolver.ts`) - ~220 lines
2. **ShapeTextEditorFactory** (`text-editor/ShapeTextEditorFactory.ts`) - ~270 lines
3. **ShapeTextPositionSync** (`text-editor/ShapeTextPositionSync.ts`) - ~260 lines
4. **openShapeTextEditor** (refactored) - ~150 lines

---

## ✅ Executable Tasks

```json
{
  "executable_tasks": [
    {
      "task_id": "shape-text-1-extract-resolver",
      "description": "Extract node resolution to ShapeTextNodeResolver.ts",
      "target_files": [{"path": "src/features/canvas/modules/text-editor/openShapeTextEditor.ts", "line_range": "51-250"}],
      "code_changes": [
        {"operation": "create", "file": "src/features/canvas/modules/text-editor/ShapeTextNodeResolver.ts", "content": "Extract resolver:\n- findTextNode()\n- getShapeTextConfig()\n- resolveTextPosition()\n- getTextBounds()"}
      ],
      "validation_steps": ["npm run type-check", "npm test -- ShapeTextNodeResolver.test.ts", "Verify resolution works"],
      "success_criteria": "Text nodes resolved correctly, all shapes supported",
      "dependencies": [],
      "rollback_procedure": "git checkout src/features/canvas/modules/text-editor/openShapeTextEditor.ts && rm src/features/canvas/modules/text-editor/ShapeTextNodeResolver.ts"
    },
    {
      "task_id": "shape-text-2-extract-factory",
      "description": "Extract editor factory to ShapeTextEditorFactory.ts",
      "target_files": [{"path": "src/features/canvas/modules/text-editor/openShapeTextEditor.ts", "line_range": "251-500"}],
      "code_changes": [
        {"operation": "create", "file": "src/features/canvas/modules/text-editor/ShapeTextEditorFactory.ts", "content": "Extract factory:\n- createEditor()\n- createTextArea()\n- applyEditorStyles()\n- attachEventListeners()"}
      ],
      "validation_steps": ["npm run type-check", "npm test -- ShapeTextEditorFactory.test.ts", "Verify editor creates"],
      "success_criteria": "Editor created correctly, styles applied",
      "dependencies": [],
      "rollback_procedure": "git checkout src/features/canvas/modules/text-editor/openShapeTextEditor.ts && rm src/features/canvas/modules/text-editor/ShapeTextEditorFactory.ts"
    },
    {
      "task_id": "shape-text-3-extract-position-sync",
      "description": "Extract position sync to ShapeTextPositionSync.ts",
      "target_files": [{"path": "src/features/canvas/modules/text-editor/openShapeTextEditor.ts", "line_range": "501-741"}],
      "code_changes": [
        {"operation": "create", "file": "src/features/canvas/modules/text-editor/ShapeTextPositionSync.ts", "content": "Extract position sync:\n- syncPosition()\n- updateWithViewport()\n- calculateScreenPosition()\n- handleViewportChange()"}
      ],
      "validation_steps": ["npm run type-check", "npm test -- ShapeTextPositionSync.test.ts", "Verify sync works"],
      "success_criteria": "Position syncs correctly, viewport-aware",
      "dependencies": [],
      "rollback_procedure": "git checkout src/features/canvas/modules/text-editor/openShapeTextEditor.ts && rm src/features/canvas/modules/text-editor/ShapeTextPositionSync.ts"
    },
    {
      "task_id": "shape-text-4-refactor-function",
      "description": "Refactor openShapeTextEditor to use extracted modules",
      "target_files": [{"path": "src/features/canvas/modules/text-editor/openShapeTextEditor.ts", "line_range": "1-741"}],
      "code_changes": [
        {"operation": "replace", "find_pattern": "All implementation", "replace_with": "Compose: Resolver, Factory, PositionSync"}
      ],
      "validation_steps": ["npm run type-check", "npm test", "npm run build"],
      "success_criteria": "Function coordinates modules, all features work",
      "dependencies": ["shape-text-1-extract-resolver", "shape-text-2-extract-factory", "shape-text-3-extract-position-sync"],
      "rollback_procedure": "git checkout src/features/canvas/modules/text-editor/"
    },
    {
      "task_id": "shape-text-5-add-tests",
      "description": "Create test suites",
      "target_files": [
        {"path": "src/features/canvas/modules/text-editor/__tests__/ShapeTextNodeResolver.test.ts", "status": "create"},
        {"path": "src/features/canvas/modules/text-editor/__tests__/ShapeTextEditorFactory.test.ts", "status": "create"},
        {"path": "src/features/canvas/modules/text-editor/__tests__/ShapeTextPositionSync.test.ts", "status": "create"}
      ],
      "code_changes": [
        {"operation": "create", "file": "src/features/canvas/modules/text-editor/__tests__/ShapeTextNodeResolver.test.ts", "content": "Test resolver"},
        {"operation": "create", "file": "src/features/canvas/modules/text-editor/__tests__/ShapeTextEditorFactory.test.ts", "content": "Test factory"},
        {"operation": "create", "file": "src/features/canvas/modules/text-editor/__tests__/ShapeTextPositionSync.test.ts", "content": "Test sync"}
      ],
      "validation_steps": ["npm test", "Check coverage >80%"],
      "success_criteria": "All tests pass, >80% coverage",
      "dependencies": ["shape-text-1-extract-resolver", "shape-text-2-extract-factory", "shape-text-3-extract-position-sync"],
      "rollback_procedure": "rm src/features/canvas/modules/text-editor/__tests__/*.test.ts"
    },
    {
      "task_id": "shape-text-6-validation",
      "description": "Validate text editor performance",
      "target_files": [{"path": "src/features/canvas/modules/text-editor/openShapeTextEditor.ts", "validation": "performance"}],
      "code_changes": [
        {"operation": "validate", "metrics": ["Editor open <50ms", "Position sync <5ms", "Viewport-aware"]}
      ],
      "validation_steps": ["Performance profiling", "Test with viewport changes"],
      "success_criteria": "Fast editor open, accurate positioning",
      "dependencies": ["shape-text-4-refactor-function"],
      "rollback_procedure": "N/A"
    }
  ],
  "execution_order": ["shape-text-1-extract-resolver", "shape-text-2-extract-factory", "shape-text-3-extract-position-sync", "shape-text-4-refactor-function", "shape-text-5-add-tests", "shape-text-6-validation"],
  "critical_warnings": ["⚠️ Editor positioning must be viewport-aware", "⚠️ All shape types must be supported", "⚠️ Position sync critical for usability"]
}
```

---

## 🎯 Success Metrics

**Before**: 741 lines, all in one function  
**After**: ~150 line function + 3 modules (~750 total)  
**Impact**: 80% function reduction, better organization

---
