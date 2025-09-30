# Port Hover Module Refactoring Plan

**File**: `src/features/canvas/modules/port-hover/PortHoverModule.ts`  
**Current Size**: 762 lines  
**Target Size**: ~150 lines  
**Reduction**: 80%  
**Priority**: MEDIUM  
**Estimated Time**: 2-3 days

---

## 📊 Current Structure Analysis

```
Lines 1-50:    Imports and setup
Lines 51-250:  Port rendering - 199 lines
Lines 251-500: Hover detection - 249 lines
Lines 501-762: Interaction handling - 261 lines
```

---

## 🎯 Refactoring Strategy

1. **PortRenderer** (`port-hover/PortRenderer.ts`) - ~220 lines
2. **PortHoverDetector** (`port-hover/PortHoverDetector.ts`) - ~270 lines
3. **PortInteractionHandler** (`port-hover/PortInteractionHandler.ts`) - ~280 lines
4. **PortHoverModule** (refactored) - ~150 lines

---

## ✅ Executable Tasks

```json
{
  "executable_tasks": [
    {
      "task_id": "port-1-extract-renderer",
      "description": "Extract port rendering to PortRenderer.ts",
      "target_files": [{"path": "src/features/canvas/modules/port-hover/PortHoverModule.ts", "line_range": "51-250"}],
      "code_changes": [
        {"operation": "create", "file": "src/features/canvas/modules/port-hover/PortRenderer.ts", "content": "Extract rendering:\n- renderPort()\n- renderPortHighlight()\n- updatePortVisuals()\n- batchDraw() [RAF]"}
      ],
      "validation_steps": ["npm run type-check", "npm test -- PortRenderer.test.ts", "Verify ports render"],
      "success_criteria": "Ports render identically, 60fps maintained",
      "dependencies": [],
      "rollback_procedure": "git checkout src/features/canvas/modules/port-hover/PortHoverModule.ts && rm src/features/canvas/modules/port-hover/PortRenderer.ts"
    },
    {
      "task_id": "port-2-extract-detector",
      "description": "Extract hover detection to PortHoverDetector.ts",
      "target_files": [{"path": "src/features/canvas/modules/port-hover/PortHoverModule.ts", "line_range": "251-500"}],
      "code_changes": [
        {"operation": "create", "file": "src/features/canvas/modules/port-hover/PortHoverDetector.ts", "content": "Extract detection:\n- detectHoveredPort()\n- calculatePortBounds()\n- isPointInPort()\n- getClosestPort()"}
      ],
      "validation_steps": ["npm run type-check", "npm test -- PortHoverDetector.test.ts", "Verify detection works"],
      "success_criteria": "Port hover detection accurate, fast (<5ms)",
      "dependencies": [],
      "rollback_procedure": "git checkout src/features/canvas/modules/port-hover/PortHoverModule.ts && rm src/features/canvas/modules/port-hover/PortHoverDetector.ts"
    },
    {
      "task_id": "port-3-extract-interaction",
      "description": "Extract interaction handling to PortInteractionHandler.ts",
      "target_files": [{"path": "src/features/canvas/modules/port-hover/PortHoverModule.ts", "line_range": "501-762"}],
      "code_changes": [
        {"operation": "create", "file": "src/features/canvas/modules/port-hover/PortInteractionHandler.ts", "content": "Extract interaction:\n- handlePortHover()\n- handlePortClick()\n- handlePortDragStart()\n- showPortTooltip()\n- hidePortTooltip()"}
      ],
      "validation_steps": ["npm run type-check", "npm test -- PortInteractionHandler.test.ts", "Verify interactions"],
      "success_criteria": "All interactions work, tooltip shows/hides correctly",
      "dependencies": [],
      "rollback_procedure": "git checkout src/features/canvas/modules/port-hover/PortHoverModule.ts && rm src/features/canvas/modules/port-hover/PortInteractionHandler.ts"
    },
    {
      "task_id": "port-4-refactor-module",
      "description": "Refactor PortHoverModule to coordinate subsystems",
      "target_files": [{"path": "src/features/canvas/modules/port-hover/PortHoverModule.ts", "line_range": "1-762"}],
      "code_changes": [
        {"operation": "replace", "find_pattern": "All implementation", "replace_with": "Compose: PortRenderer, PortHoverDetector, PortInteractionHandler"}
      ],
      "validation_steps": ["npm run type-check", "npm test", "npm run build"],
      "success_criteria": "Module coordinates subsystems, all features work",
      "dependencies": ["port-1-extract-renderer", "port-2-extract-detector", "port-3-extract-interaction"],
      "rollback_procedure": "git checkout src/features/canvas/modules/port-hover/"
    },
    {
      "task_id": "port-5-add-tests",
      "description": "Create test suites",
      "target_files": [
        {"path": "src/features/canvas/modules/port-hover/__tests__/PortRenderer.test.ts", "status": "create"},
        {"path": "src/features/canvas/modules/port-hover/__tests__/PortHoverDetector.test.ts", "status": "create"},
        {"path": "src/features/canvas/modules/port-hover/__tests__/PortInteractionHandler.test.ts", "status": "create"}
      ],
      "code_changes": [
        {"operation": "create", "file": "src/features/canvas/modules/port-hover/__tests__/PortRenderer.test.ts", "content": "Test rendering"},
        {"operation": "create", "file": "src/features/canvas/modules/port-hover/__tests__/PortHoverDetector.test.ts", "content": "Test detection"},
        {"operation": "create", "file": "src/features/canvas/modules/port-hover/__tests__/PortInteractionHandler.test.ts", "content": "Test interaction"}
      ],
      "validation_steps": ["npm test", "Check coverage >80%"],
      "success_criteria": "All tests pass, >80% coverage",
      "dependencies": ["port-1-extract-renderer", "port-2-extract-detector", "port-3-extract-interaction"],
      "rollback_procedure": "rm src/features/canvas/modules/port-hover/__tests__/*.test.ts"
    },
    {
      "task_id": "port-6-validation",
      "description": "Validate port hover performance",
      "target_files": [{"path": "src/features/canvas/modules/port-hover/PortHoverModule.ts", "validation": "performance"}],
      "code_changes": [
        {"operation": "validate", "metrics": ["Port detection <5ms", "Hover update <5ms", "60fps maintained"]}
      ],
      "validation_steps": ["Performance profiling", "Test with 100+ ports"],
      "success_criteria": "Fast detection, 60fps maintained",
      "dependencies": ["port-4-refactor-module"],
      "rollback_procedure": "N/A"
    }
  ],
  "execution_order": ["port-1-extract-renderer", "port-2-extract-detector", "port-3-extract-interaction", "port-4-refactor-module", "port-5-add-tests", "port-6-validation"],
  "critical_warnings": ["⚠️ Port detection must be accurate", "⚠️ Hover feedback must be instant (<5ms)", "⚠️ RAF batching for rendering performance"]
}
```

---

## 🎯 Success Metrics

**Before**: 762 lines, all in one module  
**After**: ~150 line core + 3 modules (~770 total)  
**Impact**: 80% core reduction, better performance

---
