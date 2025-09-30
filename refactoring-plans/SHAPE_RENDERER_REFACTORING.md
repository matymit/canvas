# Shape Renderer Refactoring Plan

**File**: `src/features/canvas/modules/rendering/ShapeRenderer.ts`  
**Current Size**: 728 lines  
**Target Size**: ~200 lines  
**Reduction**: 73%  
**Priority**: MEDIUM  
**Estimated Time**: 2-3 days

---

## 📊 Current Structure Analysis

```
Lines 1-50:    Imports and setup
Lines 51-300:  Shape node factory - 249 lines
Lines 301-500: Text management - 199 lines
Lines 501-728: Transform synchronization - 227 lines
```

---

## 🎯 Refactoring Strategy

1. **ShapeNodeFactory** (`rendering/ShapeNodeFactory.ts`) - ~270 lines
2. **ShapeTextManager** (`rendering/ShapeTextManager.ts`) - ~220 lines
3. **ShapeTransformSync** (`rendering/ShapeTransformSync.ts`) - ~250 lines
4. **ShapeRenderer** (refactored) - ~200 lines

---

## ✅ Executable Tasks

```json
{
  "executable_tasks": [
    {
      "task_id": "shape-1-extract-factory",
      "description": "Extract shape factory to ShapeNodeFactory.ts",
      "target_files": [{"path": "src/features/canvas/modules/rendering/ShapeRenderer.ts", "line_range": "51-300"}],
      "code_changes": [
        {"operation": "create", "file": "src/features/canvas/modules/rendering/ShapeNodeFactory.ts", "content": "Extract factory:\n- createShapeNode(type)\n- createRectangle()\n- createCircle()\n- createTriangle()\n- applyShapeStyles()"}
      ],
      "validation_steps": ["npm run type-check", "npm test -- ShapeNodeFactory.test.ts", "Verify shapes create"],
      "success_criteria": "All shape types create correctly, styles applied",
      "dependencies": [],
      "rollback_procedure": "git checkout src/features/canvas/modules/rendering/ShapeRenderer.ts && rm src/features/canvas/modules/rendering/ShapeNodeFactory.ts"
    },
    {
      "task_id": "shape-2-extract-text-manager",
      "description": "Extract text management to ShapeTextManager.ts",
      "target_files": [{"path": "src/features/canvas/modules/rendering/ShapeRenderer.ts", "line_range": "301-500"}],
      "code_changes": [
        {"operation": "create", "file": "src/features/canvas/modules/rendering/ShapeTextManager.ts", "content": "Extract text manager:\n- createTextNode()\n- updateTextContent()\n- syncTextPosition()\n- handleTextResize()"}
      ],
      "validation_steps": ["npm run type-check", "npm test -- ShapeTextManager.test.ts", "Verify text works"],
      "success_criteria": "Text renders correctly, position syncs",
      "dependencies": [],
      "rollback_procedure": "git checkout src/features/canvas/modules/rendering/ShapeRenderer.ts && rm src/features/canvas/modules/rendering/ShapeTextManager.ts"
    },
    {
      "task_id": "shape-3-extract-transform-sync",
      "description": "Extract transform sync to ShapeTransformSync.ts",
      "target_files": [{"path": "src/features/canvas/modules/rendering/ShapeRenderer.ts", "line_range": "501-728"}],
      "code_changes": [
        {"operation": "create", "file": "src/features/canvas/modules/rendering/ShapeTransformSync.ts", "content": "Extract transform sync:\n- syncTransform()\n- applyPosition()\n- applyRotation()\n- applyScale()"}
      ],
      "validation_steps": ["npm run type-check", "npm test -- ShapeTransformSync.test.ts", "Verify transforms"],
      "success_criteria": "Transforms apply correctly, no visual glitches",
      "dependencies": [],
      "rollback_procedure": "git checkout src/features/canvas/modules/rendering/ShapeRenderer.ts && rm src/features/canvas/modules/rendering/ShapeTransformSync.ts"
    },
    {
      "task_id": "shape-4-refactor-renderer",
      "description": "Refactor ShapeRenderer to coordinate modules",
      "target_files": [{"path": "src/features/canvas/modules/rendering/ShapeRenderer.ts", "line_range": "1-728"}],
      "code_changes": [
        {"operation": "replace", "find_pattern": "All implementation", "replace_with": "Compose: Factory, TextManager, TransformSync"}
      ],
      "validation_steps": ["npm run type-check", "npm test", "npm run build"],
      "success_criteria": "Renderer coordinates modules, all shapes work",
      "dependencies": ["shape-1-extract-factory", "shape-2-extract-text-manager", "shape-3-extract-transform-sync"],
      "rollback_procedure": "git checkout src/features/canvas/modules/rendering/"
    },
    {
      "task_id": "shape-5-add-tests",
      "description": "Create test suites",
      "target_files": [
        {"path": "src/features/canvas/modules/rendering/__tests__/ShapeNodeFactory.test.ts", "status": "create"},
        {"path": "src/features/canvas/modules/rendering/__tests__/ShapeTextManager.test.ts", "status": "create"},
        {"path": "src/features/canvas/modules/rendering/__tests__/ShapeTransformSync.test.ts", "status": "create"}
      ],
      "code_changes": [
        {"operation": "create", "file": "src/features/canvas/modules/rendering/__tests__/ShapeNodeFactory.test.ts", "content": "Test factory"},
        {"operation": "create", "file": "src/features/canvas/modules/rendering/__tests__/ShapeTextManager.test.ts", "content": "Test text"},
        {"operation": "create", "file": "src/features/canvas/modules/rendering/__tests__/ShapeTransformSync.test.ts", "content": "Test transforms"}
      ],
      "validation_steps": ["npm test", "Check coverage >80%"],
      "success_criteria": "All tests pass, >80% coverage",
      "dependencies": ["shape-1-extract-factory", "shape-2-extract-text-manager", "shape-3-extract-transform-sync"],
      "rollback_procedure": "rm src/features/canvas/modules/rendering/__tests__/*.test.ts"
    },
    {
      "task_id": "shape-6-validation",
      "description": "Validate shape rendering performance",
      "target_files": [{"path": "src/features/canvas/modules/rendering/ShapeRenderer.ts", "validation": "performance"}],
      "code_changes": [
        {"operation": "validate", "metrics": ["Shape creation <16ms", "Transform update <5ms", "60fps maintained"]}
      ],
      "validation_steps": ["Performance profiling", "Test with 500+ shapes"],
      "success_criteria": "Fast rendering, 60fps maintained",
      "dependencies": ["shape-4-refactor-renderer"],
      "rollback_procedure": "N/A"
    }
  ],
  "execution_order": ["shape-1-extract-factory", "shape-2-extract-text-manager", "shape-3-extract-transform-sync", "shape-4-refactor-renderer", "shape-5-add-tests", "shape-6-validation"],
  "critical_warnings": ["⚠️ All shape types must render correctly", "⚠️ Text positioning critical", "⚠️ Transform synchronization must be accurate", "⚠️ RAF batching for performance"]
}
```

---

## 🎯 Success Metrics

**Before**: 728 lines, all in one renderer  
**After**: ~200 line core + 3 modules (~740 total)  
**Impact**: 73% core reduction, better organization

---
